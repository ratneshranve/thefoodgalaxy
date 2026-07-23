/**
 * Google Maps API Key — build-time .env only.
 * Reads directly from .env variables without network calls.
 */

import { useEffect, useState } from "react";

function sanitizeApiKey(value) {
  if (!value) return "";
  return String(value).trim().replace(/^['"]|['"]$/g, "");
}

function getBuildTimeKey() {
  return (
    sanitizeApiKey(import.meta.env.VITE_GOOGLE_MAPS_API_KEY) ||
    sanitizeApiKey(import.meta.env.GOOGLE_MAPS_API_KEY)
  );
}

/**
 * Resolve Google Maps API key synchronously from .env.
 */
export async function getGoogleMapsApiKey() {
  return getBuildTimeKey();
}

/** Sync peek — returns .env key directly. */
export function getGoogleMapsApiKeySync() {
  return getBuildTimeKey();
}

export function clearGoogleMapsApiKeyCache() {
  /* no-op */
}

/** Whether maps can be enabled from .env configuration. */
export function isGoogleMapsConfigured() {
  return Boolean(getGoogleMapsApiKeySync());
}

/** React hook for @react-google-maps/api — returns .env key directly. */
export function useGoogleMapsApiKey() {
  const [apiKey, setApiKey] = useState(() => getGoogleMapsApiKeySync());

  useEffect(() => {
    setApiKey(getBuildTimeKey());
  }, []);

  return apiKey;
}
