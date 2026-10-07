import { config } from '../config/env.js';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { haversineMeters, estimateEtaSeconds, roundCoord } from '../utils/geo.js';

let redisClient = null;
if (config.redisEnabled && config.redisUrl) {
    // Cache only: fail fast when Redis is down instead of queueing commands and stalling requests.
    redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => Math.min(times * 500, 10000)
    });
    redisClient.on('error', (err) => logger.warn(`Distance cache Redis error: ${err.message}`));
}

/**
 * Google Distance Matrix is billed PER ELEMENT (one origin x one destination), so this
 * module is built to make as few billable elements as possible:
 *
 *  - Browsing (home / restaurant lists / search / restaurant page) uses a free straight-line
 *    estimate (see getBrowseDistances). Set MAPS_BROWSE_USE_API=true to use Google there too.
 *  - Checkout / delivery fee / tracking use getDrivingDistances, which only calls Google for
 *    pairs that are not cached. Cache keys round the coordinates, so nearby users and a slowly
 *    moving rider share results. Works with Redis (shared) and falls back to in-memory.
 *  - In-flight requests for the same pair are shared, and an API failure falls back to the
 *    straight-line estimate instead of retrying.
 */

const ROAD_FACTOR = 1.35; // straight line -> typical road distance
const CACHE_TTL_SECONDS = Number(process.env.MAPS_DISTANCE_CACHE_TTL || 7 * 24 * 60 * 60);
const ORIGIN_PRECISION = Number(process.env.MAPS_DISTANCE_ORIGIN_PRECISION || 3); // 3 decimals ~ 110 m
const MEMORY_CACHE_MAX = 5000;

const memoryCache = new Map(); // key -> { value, expiresAt }
const inFlight = new Map(); // key -> Promise<distanceInfo|null>

const formatKm = (meters) => (meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`);

const formatMinutes = (seconds) => {
    const mins = Math.max(1, Math.round(seconds / 60));
    if (mins < 60) return `${mins} mins`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} hr ${m} mins` : `${h} hr`;
};

/** Free straight-line based estimate in the same shape as a Google result. */
export function estimateDrivingDistance(origin, dest) {
    const straight = haversineMeters(origin.lat, origin.lng, dest.lat, dest.lng);
    if (straight === null || !Number.isFinite(straight)) return null;
    const meters = Math.round(straight * ROAD_FACTOR);
    const seconds = estimateEtaSeconds(meters);
    return {
        distanceText: formatKm(meters),
        distanceValue: meters,
        durationText: formatMinutes(seconds),
        durationValue: seconds,
        estimated: true
    };
}

const pairKey = (origin, dest, precision) => {
    const oLat = roundCoord(origin.lat, precision);
    const oLng = roundCoord(origin.lng, precision);
    const dLat = roundCoord(dest.lat, 5);
    const dLng = roundCoord(dest.lng, 5);
    return `distance:${oLat},${oLng}:${dLat},${dLng}`;
};

const memoryGet = (key) => {
    const hit = memoryCache.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
        memoryCache.delete(key);
        return null;
    }
    return hit.value;
};

const memorySet = (key, value, ttlSeconds) => {
    if (memoryCache.size >= MEMORY_CACHE_MAX) {
        // Drop the oldest entry (Map keeps insertion order).
        memoryCache.delete(memoryCache.keys().next().value);
    }
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
};

const cacheGet = async (key) => {
    const local = memoryGet(key);
    if (local) return local;
    if (!redisClient) return null;
    try {
        const cached = await redisClient.get(key);
        if (cached) {
            const value = JSON.parse(cached);
            memorySet(key, value, 600);
            return value;
        }
    } catch (err) {
        logger.warn(`Redis get error: ${err.message}`);
    }
    return null;
};

const cacheSet = async (key, value) => {
    memorySet(key, value, CACHE_TTL_SECONDS);
    if (!redisClient) return;
    await redisClient.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS).catch(() => {});
};

const isValidPoint = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && (Number(p.lat) !== 0 || Number(p.lng) !== 0);

/**
 * Distances for LIST / BROWSE screens (home, restaurant lists, search, restaurant page).
 * Free straight-line estimate by default; no Google call.
 * Set MAPS_BROWSE_USE_API=true to use real road distances (billed) with the same caching.
 */
export async function getBrowseDistances(origin, destinations) {
    if (process.env.MAPS_BROWSE_USE_API === 'true') {
        return getDrivingDistances(origin, destinations);
    }
    const resultMap = new Map();
    if (!isValidPoint(origin) || !destinations?.length) return resultMap;
    for (const dest of destinations) {
        if (!isValidPoint(dest)) continue;
        const info = estimateDrivingDistance(origin, dest);
        if (info) resultMap.set(String(dest.id), info);
    }
    return resultMap;
}

/**
 * Real driving distances (Google Distance Matrix) for checkout, delivery fee and tracking.
 * Only uncached origin/destination pairs are billed.
 *
 * @param {Object} origin { lat, lng }
 * @param {Array<Object>} destinations [{ id, lat, lng }]
 * @param {Object} [options] { precision } decimals used to round the ORIGIN for cache keys
 * @returns {Promise<Map<string, Object>>} Map of destination ID to distance info
 */
export async function getDrivingDistances(origin, destinations, options = {}) {
    const resultMap = new Map();
    if (!isValidPoint(origin) || !destinations || destinations.length === 0) {
        return resultMap;
    }

    const apiKey = config.googleMapsApiKey;
    const precision = Number.isInteger(options.precision) ? options.precision : ORIGIN_PRECISION;
    const toFetch = [];
    const waiting = [];

    for (const dest of destinations) {
        if (!isValidPoint(dest)) continue;
        const key = pairKey(origin, dest, precision);

        const cached = await cacheGet(key);
        if (cached) {
            resultMap.set(String(dest.id), cached);
            continue;
        }
        if (!apiKey) {
            const estimate = estimateDrivingDistance(origin, dest);
            if (estimate) resultMap.set(String(dest.id), estimate);
            continue;
        }
        if (inFlight.has(key)) {
            waiting.push({ dest, key, promise: inFlight.get(key) });
            continue;
        }
        toFetch.push({ dest, key });
    }

    if (!apiKey && destinations.length) {
        logger.warn('Google Maps API key missing. Using straight-line distance estimates.');
    }

    // Google limits a request to 25 destinations. Chunk, and register the in-flight promises
    // first so concurrent requests for the same pair reuse this call.
    const CHUNK_SIZE = 25;
    const chunks = [];
    for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) chunks.push(toFetch.slice(i, i + CHUNK_SIZE));

    await Promise.all(chunks.map(async (chunk) => {
        const resolvers = new Map();
        for (const item of chunk) {
            inFlight.set(item.key, new Promise((resolve) => resolvers.set(item.key, resolve)));
        }
        const settle = (item, value) => {
            inFlight.delete(item.key);
            resolvers.get(item.key)?.(value);
        };

        const originKey = `${origin.lat},${origin.lng}`;
        const destStrings = chunk.map(({ dest }) => `${dest.lat},${dest.lng}`).join('|');
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originKey}&destinations=${destStrings}&key=${apiKey}&mode=driving`;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            const data = await res.json();

            if (data.status === 'OK' && data.rows?.length > 0) {
                const elements = data.rows[0].elements;
                for (let j = 0; j < chunk.length; j++) {
                    const item = chunk[j];
                    const el = elements[j];
                    let info = null;
                    if (el && el.status === 'OK') {
                        info = {
                            distanceText: el.distance.text, // e.g. "2.6 km"
                            distanceValue: el.distance.value, // meters
                            durationText: el.duration.text,
                            durationValue: el.duration.value
                        };
                        await cacheSet(item.key, info);
                    } else {
                        info = estimateDrivingDistance(origin, item.dest);
                    }
                    if (info) resultMap.set(String(item.dest.id), info);
                    settle(item, info);
                }
            } else {
                logger.warn(`Google Distance Matrix API returned status: ${data.status}. Error: ${data.error_message}`);
                for (const item of chunk) {
                    const info = estimateDrivingDistance(origin, item.dest);
                    if (info) resultMap.set(String(item.dest.id), info);
                    settle(item, info);
                }
            }
        } catch (err) {
            logger.error(`Error fetching distance matrix: ${err.message}`);
            for (const item of chunk) {
                const info = estimateDrivingDistance(origin, item.dest);
                if (info) resultMap.set(String(item.dest.id), info);
                settle(item, info);
            }
        }
    }));

    for (const { dest, promise } of waiting) {
        const info = await promise;
        if (info) resultMap.set(String(dest.id), info);
    }

    return resultMap;
}
