/**
 * Helper to resolve media URLs consistently across the app.
 * Handles absolute URLs (http, https, Cloudinary, data, blob) and relative upload paths.
 */
export const getMediaUrl = (url) => {
  if (!url) return "";
  
  if (typeof url !== "string") {
    return url.url || url.secure_url || url.imageUrl || url.image || url.src || url.mediaUrl || "";
  }
  
  // If it's already an absolute URL or data URI, return as-is
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }
  
  // Base origin resolution
  const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "http://localhost:5000/api/v1";
  const origin = apiBase.includes("/api/v1") ? apiBase.split("/api/v1")[0] : apiBase.replace(/\/$/, "");
  
  // If url begins with /api/v1 or api/v1
  if (url.startsWith("/api/v1") || url.startsWith("api/v1")) {
    return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
  }
  
  // If url begins with /uploads or uploads
  if (url.startsWith("/uploads") || url.startsWith("uploads")) {
    const cleanPath = url.startsWith("/") ? url : `/${url}`;
    return `${origin}${cleanPath}`;
  }
  
  // Otherwise append to origin with leading slash
  return `${origin}/${url.replace(/^\/+/, "")}`;
};

export default getMediaUrl;
