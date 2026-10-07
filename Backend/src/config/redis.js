import { createClient } from 'redis';
import { config } from './env.js';
import { logger } from '../utils/logger.js';

let redisClient = null;

/**
 * Creates a new Redis client instance based on configuration.
 * @returns {import('redis').RedisClientType|null}
 */
export const createRedisClient = () => {
    if (!config.redisUrl) {
        logger.warn('Redis URL not provided, Redis client will not be created.');
        return null;
    }

    const client = createClient({
        url: config.redisUrl,
        socket: {
            connectTimeout: 5000,
            // Keep retrying in the background with a capped backoff instead of giving up.
            reconnectStrategy: (retries) => Math.min(retries * 500, 10000)
        }
    });

    client.on('error', (err) => logger.error(`Redis Client Error: ${err.message}`));
    client.on('connect', () => logger.info('Redis connecting...'));
    client.on('ready', () => logger.info('Redis client ready'));
    client.on('end', () => logger.warn('Redis client disconnected'));

    return client;
};

/**
 * Connects to Redis if REDIS_ENABLED is true.
 * @returns {Promise<import('redis').RedisClientType|null>}
 */
export const connectRedis = async () => {
    const isRedisEnabled = config.redisEnabled;

    if (!isRedisEnabled) {
        logger.info('Redis is disabled via REDIS_ENABLED flag.');
        return null;
    }

    try {
        if (!redisClient) {
            redisClient = createRedisClient();
        }

        if (redisClient) {
            // connect() never settles while Redis is unreachable (it retries forever), which
            // would block API startup. Give up waiting after 8 s; the client keeps retrying in
            // the background and the app runs without cache until it is ready.
            await Promise.race([
                redisClient.connect(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('connect timeout after 8s (is Redis running?)')), 8000)
                )
            ]);
            logger.info('Successfully connected to Redis');
        }
        return redisClient;
    } catch (error) {
        logger.error(`Failed to connect to Redis: ${error.message}`);
        return null;
    }
};

/**
 * Returns the existing Redis client.
 * @returns {import('redis').RedisClientType|null}
 */
export const getRedisClient = () => {
    return redisClient;
};

/**
 * Close Redis connection (e.g. graceful shutdown).
 * @returns {Promise<void>}
 */
export const closeRedis = async () => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger.info('Redis connection closed');
    }
};
