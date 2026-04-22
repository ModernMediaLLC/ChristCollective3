import { isNativeApp } from "./platform";

/**
 * Get the API base URL based on environment
 * - Web: uses relative URLs (same origin)
 * - Mobile: uses full backend URL
 */
export function getApiBaseUrl(): string {
  if (isNativeApp()) {
    // Mobile app: use the deployed backend URL
    return import.meta.env.VITE_API_URL || 'https://www.christcollective.com';
  }
  
  // Web: use relative URLs (same origin)
  return '';
}

/**
 * Returns headers required for authenticated mobile API calls.
 * On mobile the session cookie isn't sent cross-domain, so we include
 * the session ID from localStorage as an X-Session-ID header instead.
 */
export function getMobileAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const sessionId = localStorage.getItem('sessionId');
  if (sessionId) {
    headers['X-Session-ID'] = sessionId;
  }
  return headers;
}

export function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Get a Supabase image URL with optional resize transform.
 * Pass size (e.g. 80) to serve a resized thumbnail instead of the full image.
 */
export function getProfileImageUrl(imageUrl: string | null | undefined, _size = 80): string {
  return getImageUrl(imageUrl);
}

/**
 * Convert image URL to full URL for mobile apps
 * - Web: returns the URL as-is (relative paths work)
 * - Mobile: prepends backend URL to relative paths
 */
export function getImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return '';
  
  // For mobile apps, we need to handle URLs differently
  if (isNativeApp()) {
    const baseUrl = getApiBaseUrl();
    
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      try {
        const url = new URL(imageUrl);
        const path = url.pathname;
        if (path.startsWith('/uploads/') || path.startsWith('/objects/')) {
          return `${baseUrl}${path}`;
        }
      } catch (e) {
      }
      return imageUrl;
    }
    
    // Convert relative paths to full URLs
    const normalizedPath = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${baseUrl}${normalizedPath}`;
  }
  
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const url = new URL(imageUrl);
      const path = url.pathname;
      if (path.startsWith('/uploads/') || path.startsWith('/objects/')) {
        return `${window.location.origin}${path}`;
      }
    } catch (e) {
    }
    return imageUrl;
  }
  
  // For web, return relative path as-is
  return imageUrl;
}
