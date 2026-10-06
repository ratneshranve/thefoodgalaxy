import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { FoodBusinessSettings } from '../modules/food/admin/models/businessSettings.model.js';
import { resolveUploadRoot, resolveVpsUploadRoot, getUploadPublicUrl } from '../utils/uploadPaths.js';
import { logger } from '../utils/logger.js';

/**
 * Pluggable upload storage used by every upload in the app.
 *
 *   local       -> files saved on this machine (Backend/uploads), served at /uploads
 *   vps         -> files saved in a server directory (default /var/www/uploads);
 *                  served by Express at /uploads, or by nginx/CDN when
 *                  UPLOAD_VPS_PUBLIC_URL is set
 *   cloudinary  -> files uploaded to your Cloudinary account
 *
 * The active provider is chosen in Admin -> Toggle Management (stored in
 * FoodBusinessSettings.uploadProvider) and falls back to UPLOAD_PROVIDER in .env.
 * It only affects NEW uploads; old files keep working where they are.
 */

export const UPLOAD_PROVIDERS = ['local', 'vps', 'cloudinary'];
const DEFAULT_PROVIDER = 'local';
const PROVIDER_CACHE_TTL_MS = 60 * 1000;

export const normalizeUploadProvider = (value, fallback = DEFAULT_PROVIDER) => {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'system') return 'local'; // legacy name (BiteCube)
    return UPLOAD_PROVIDERS.includes(v) ? v : fallback;
};

const providerCache = { value: null, expiresAt: 0 };

export const setActiveUploadProvider = (provider) => {
    providerCache.value = normalizeUploadProvider(provider);
    providerCache.expiresAt = Date.now() + PROVIDER_CACHE_TTL_MS;
};

export const getActiveUploadProvider = async () => {
    if (providerCache.value && providerCache.expiresAt > Date.now()) return providerCache.value;
    try {
        const settings = await FoodBusinessSettings.findOne().select('uploadProvider').lean();
        setActiveUploadProvider(settings?.uploadProvider || process.env.UPLOAD_PROVIDER);
    } catch {
        setActiveUploadProvider(process.env.UPLOAD_PROVIDER);
    }
    return providerCache.value;
};

// ---------- provider readiness ----------

const cleanEnv = (value) => String(value || '').trim().replace(/^['"]|['"]$/g, '');

const isDirWritable = (dir) => {
    try {
        fs.mkdirSync(dir, { recursive: true });
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
};

const cloudinaryCredentials = () => ({
    cloud_name: cleanEnv(process.env.CLOUDINARY_CLOUD_NAME),
    api_key: cleanEnv(process.env.CLOUDINARY_API_KEY),
    api_secret: cleanEnv(process.env.CLOUDINARY_API_SECRET),
});

const hasCloudinaryConfig = () => {
    const c = cloudinaryCredentials();
    return Boolean(c.cloud_name && c.api_key && c.api_secret);
};

const configureCloudinary = () => {
    cloudinary.config({ ...cloudinaryCredentials(), secure: true });
};

const getVpsPublicBase = () => cleanEnv(process.env.UPLOAD_VPS_PUBLIC_URL).replace(/\/+$/, '');

/** Readiness of each provider, shown in the admin panel. */
export const getStorageStatus = async () => {
    const localDir = resolveUploadRoot();
    const vpsDir = resolveVpsUploadRoot();
    const localOk = isDirWritable(localDir);
    const vpsOk = isDirWritable(vpsDir);
    const cloudOk = hasCloudinaryConfig();

    return {
        activeProvider: await getActiveUploadProvider(),
        providers: {
            local: {
                available: localOk,
                path: localDir,
                message: localOk ? 'Ready' : 'Folder is missing or not writable',
            },
            vps: {
                available: vpsOk,
                path: vpsDir,
                publicUrl: getVpsPublicBase() || null,
                message: vpsOk
                    ? 'Ready'
                    : 'Folder is missing or not writable. Create it on the server and give the app write access (UPLOAD_VPS_DIR)',
            },
            cloudinary: {
                available: cloudOk,
                cloudName: cloudinaryCredentials().cloud_name || null,
                message: cloudOk ? 'Ready' : 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the backend .env',
            },
        },
    };
};

const isProviderAvailable = (provider) => {
    if (provider === 'cloudinary') return hasCloudinaryConfig();
    if (provider === 'vps') return isDirWritable(resolveVpsUploadRoot());
    return isDirWritable(resolveUploadRoot());
};

/** Throws a readable error when the admin tries to switch to a provider that is not ready. */
export const assertProviderAvailable = (provider) => {
    const p = normalizeUploadProvider(provider);
    if (!isProviderAvailable(p)) {
        const hint = {
            local: 'The local upload folder is not writable.',
            vps: 'The VPS upload folder (UPLOAD_VPS_DIR) is missing or not writable on this server.',
            cloudinary: 'Cloudinary credentials are missing in the backend .env.',
        }[p];
        const err = new Error(`Cannot use "${p}" storage: ${hint}`);
        err.statusCode = 400;
        throw err;
    }
    return p;
};

// ---------- save / delete ----------

const safeRelative = (folder, fileName) => {
    const f = String(folder || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').split('/').filter((s) => s && s !== '..' && s !== '.').join('/');
    const n = path.basename(String(fileName || ''));
    if (!f || !n) throw new Error('Folder and file name are required');
    return { folder: f, fileName: n };
};

const saveToDisk = async ({ provider, buffer, folder, fileName }) => {
    const root = provider === 'vps' ? resolveVpsUploadRoot() : resolveUploadRoot();
    const rel = safeRelative(folder, fileName);
    const dir = path.join(root, rel.folder);
    fs.mkdirSync(dir, { recursive: true });
    await fs.promises.writeFile(path.join(dir, rel.fileName), buffer);

    const relativePath = `${rel.folder}/${rel.fileName}`;
    const publicBase = provider === 'vps' ? getVpsPublicBase() : '';
    const url = publicBase ? `${publicBase}/${relativePath}` : getUploadPublicUrl(rel.folder, rel.fileName);
    return { url, publicId: `${provider}:${relativePath}`, provider };
};

const saveToCloudinary = (buffer, folder, fileName, resourceType) =>
    new Promise((resolve, reject) => {
        configureCloudinary();
        const { name, ext } = path.parse(fileName);
        const options = {
            folder: String(folder || 'uploads').replace(/^\/+|\/+$/g, ''),
            resource_type: resourceType,
            // raw files (PDF) need their extension to download correctly
            public_id: resourceType === 'raw' ? `${name}${ext}` : name,
            overwrite: false,
        };
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve({ url: result.secure_url, publicId: result.public_id, provider: 'cloudinary' });
        });
        stream.end(buffer);
    });

/**
 * Save a buffer with the active provider.
 * @returns {{ url: string, publicId: string, provider: string }}
 */
export const saveBuffer = async ({ buffer, folder = 'uploads', fileName, resourceType = 'image' }) => {
    if (!buffer) throw new Error('File buffer is required');
    let provider = await getActiveUploadProvider();

    if (!isProviderAvailable(provider)) {
        logger.warn(`[storage] "${provider}" storage is not available, falling back to local storage`);
        provider = 'local';
    }

    if (provider === 'cloudinary') {
        return saveToCloudinary(buffer, folder, fileName, resourceType);
    }
    return saveToDisk({ provider, buffer, folder, fileName });
};

const isInside = (root, target) => {
    const rel = path.relative(path.resolve(root), path.resolve(target));
    return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
};

const deleteFromDisk = async (relativePath, preferredProvider) => {
    const parts = String(relativePath || '').replace(/\\/g, '/').split('/').filter((s) => s && s !== '..' && s !== '.');
    if (!parts.length) return false;
    const rel = parts.join('/');
    const roots = preferredProvider === 'vps'
        ? [resolveVpsUploadRoot(), resolveUploadRoot()]
        : [resolveUploadRoot(), resolveVpsUploadRoot()];

    for (const root of roots) {
        const target = path.join(root, rel);
        if (!isInside(root, target) || !fs.existsSync(target)) continue;
        try {
            await fs.promises.unlink(target);
            return true;
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
        }
    }
    return false;
};

const guessCloudinaryResourceType = (url) => {
    const u = String(url || '');
    if (u.includes('/video/upload/')) return 'video';
    if (u.includes('/raw/upload/')) return 'raw';
    return 'image';
};

const publicIdFromCloudinaryUrl = (url) => {
    const m = String(url).match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
    return m ? m[1] : '';
};

/**
 * Delete a stored asset. `ref` can be the publicId returned by saveBuffer
 * ("local:foods/a.webp", "vps:foods/a.webp", a Cloudinary public_id) or a URL.
 * Never throws for "not found"; returns whether something was deleted.
 */
export const deleteStoredAsset = async (ref, { url } = {}) => {
    const id = String(ref || '').trim();
    const link = String(url || '').trim();
    try {
        const prefixed = id.match(/^(local|vps):(.+)$/);
        if (prefixed) return await deleteFromDisk(prefixed[2], prefixed[1]);

        const candidate = link || id;
        const isHttp = /^https?:\/\//i.test(candidate);

        if (isHttp && /res\.cloudinary\.com/i.test(candidate)) {
            if (!hasCloudinaryConfig()) return false;
            configureCloudinary();
            const publicId = id && !/^https?:\/\//i.test(id) ? id : publicIdFromCloudinaryUrl(candidate);
            if (!publicId) return false;
            const res = await cloudinary.uploader.destroy(publicId, { resource_type: guessCloudinaryResourceType(candidate) });
            return res?.result === 'ok';
        }

        const vpsBase = getVpsPublicBase();
        if (isHttp && vpsBase && candidate.startsWith(`${vpsBase}/`)) {
            return await deleteFromDisk(candidate.slice(vpsBase.length + 1).split('?')[0], 'vps');
        }

        const local = candidate.split('?')[0].match(/\/uploads\/(.+)$/);
        if (local) return await deleteFromDisk(local[1], 'local');

        // A bare Cloudinary public_id (old records have no prefix and no local URL)
        if (id && !isHttp && hasCloudinaryConfig()) {
            configureCloudinary();
            const res = await cloudinary.uploader.destroy(id);
            return res?.result === 'ok';
        }
    } catch (error) {
        logger.warn(`[storage] could not delete asset "${id || link}": ${error?.message || error}`);
    }
    return false;
};
