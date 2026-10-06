import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { saveBuffer, deleteStoredAsset } from './storage.service.js';

/**
 * Upload facade used across the backend. The file name is historical: it no
 * longer talks to Cloudinary directly. Every function goes through
 * storage.service.js, which saves to the provider chosen in the admin panel
 * (local disk, VPS folder or Cloudinary).
 */

const getProcessingOptions = (folder) => {
    // defaults
    let width = 800;
    let height = 800;
    let quality = 80;
    let prefix = 'img';

    if (folder.includes('food/items')) {
        width = 800; height = 800; quality = 85; prefix = 'food';
    } else if (folder.includes('food/restaurants/profile') || folder.includes('users/profiles')) {
        width = 400; height = 400; quality = 80; prefix = 'user';
    } else if (folder.includes('food/restaurants') || folder.includes('restaurants')) {
        // cover, menu, pan, gst, fssai
        width = 1200; height = 800; quality = 80; prefix = 'restaurant';
    } else if (folder.includes('landing/banners') || folder.includes('banners')) {
        width = 1600; height = 600; quality = 85; prefix = 'banner';
    }

    return { width, height, quality, prefix };
};

const shortId = () => uuidv4().replace(/-/g, '').substring(0, 8);

/** Resize + convert to WebP, then store. Returns { secure_url, public_id, provider }. */
export const uploadImageBufferDetailed = async (buffer, folder = 'uploads') => {
    if (!buffer) {
        throw new Error('File buffer is required');
    }

    const { width, height, quality, prefix } = getProcessingOptions(folder);
    const processed = await sharp(buffer)
        .resize({ width, height, fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();

    const saved = await saveBuffer({
        buffer: processed,
        folder,
        fileName: `${prefix}_${shortId()}.webp`,
        resourceType: 'image',
    });
    return { secure_url: saved.url, public_id: saved.publicId, provider: saved.provider };
};

export const uploadImageBuffer = async (buffer, folder = 'uploads') => {
    const { secure_url } = await uploadImageBufferDetailed(buffer, folder);
    return secure_url;
};

export const uploadVideoBuffer = async (buffer, folder = 'uploads') => {
    // sharp does not handle video, store as-is
    if (!buffer) throw new Error('File buffer is required');
    const saved = await saveBuffer({
        buffer,
        folder,
        fileName: `video_${shortId()}.mp4`,
        resourceType: 'video',
    });
    return saved.url;
};

export const uploadFileBufferDetailed = async (buffer, folder = 'uploads', options = {}) => {
    if (!buffer) throw new Error('File buffer is required');

    let fileName = options.fileName ? String(options.fileName).replace(/\s+/g, '_') : `file_${shortId()}`;
    // ensure extension if format provided
    if (options.format && !fileName.endsWith(`.${options.format}`)) {
        fileName += `.${options.format}`;
    }

    const saved = await saveBuffer({ buffer, folder, fileName, resourceType: 'raw' });
    return { secure_url: saved.url, public_id: saved.publicId, provider: saved.provider };
};

export const uploadFileBuffer = async (buffer, folder = 'uploads', options = {}) => {
    const { secure_url } = await uploadFileBufferDetailed(buffer, folder, options);
    return secure_url;
};

/** Delete a previously uploaded file (works for local, VPS and Cloudinary assets). */
export const deleteUploadedAsset = (publicIdOrUrl, options = {}) => deleteStoredAsset(publicIdOrUrl, options);

export const buildRawDownloadUrlFromFileUrl = (fileUrl, options = {}) => {
    // Local / VPS / Cloudinary URLs are all directly downloadable
    return fileUrl;
};
