const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`;
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

export function buildApiUrl(path = '') {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_URL}${normalizedPath}`;
}

let isRedirecting = false;
let isRefreshing = false;
let refreshPromise = null;

async function tryRefreshToken() {
    if (isRefreshing) {
        return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = fetch(buildApiUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(async (res) => {
            if (res.ok) {
                const data = await res.json();
                return { success: true, data };
            }
            return { success: false };
        })
        .catch(() => ({ success: false }))
        .finally(() => {
            isRefreshing = false;
            refreshPromise = null;
        });

    return refreshPromise;
}

const requestCache = new Map();
const inFlightRequests = new Map();

export function clearApiCache(urlPrefix = null) {
    if (!urlPrefix) {
        requestCache.clear();
        return;
    }
    for (const key of requestCache.keys()) {
        if (key.includes(urlPrefix)) {
            requestCache.delete(key);
        }
    }
}

async function executeFetch(fullUrl, config, url) {
    let response = await fetch(fullUrl, config);

    if (response.status === 401 &&
        !url.includes('/auth/refresh') &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/signup')) {
        const refreshResult = await tryRefreshToken();
        if (refreshResult.success) {
            response = await fetch(fullUrl, config);
        } else {
            const onAuthPage = ['/login', '/signup'].includes(window.location.pathname);
            if (!isRedirecting && !onAuthPage) {
                isRedirecting = true;
                setTimeout(() => {
                    window.location.href = '/login';
                }, 100);
            }
        }
    }

    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {
        const error = new Error(
            (typeof data === 'object' && data?.message) ||
            (typeof data === 'string' && data) ||
            `Request failed with status ${response.status}`
        );
        error.response = {
            status: response.status,
            data: data,
            headers: response.headers
        };
        throw error;
    }

    return { data, status: response.status, headers: response.headers };
}

async function request(url, options = {}) {
    let fullUrl = url.startsWith('http') ? url : buildApiUrl(url);

    if (options.params && typeof options.params === 'object') {
        const queryParams = new URLSearchParams();
        Object.entries(options.params).forEach(([key, val]) => {
            if (val !== undefined && val !== null) {
                queryParams.append(key, val);
            }
        });
        const queryString = queryParams.toString();
        if (queryString) {
            fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
        }
    }

    const isGet = !options.method || options.method === 'GET';

    // Auto-invalidate caches on mutations (POST, PUT, PATCH, DELETE)
    if (!isGet) {
        const cleanPath = url.split('?')[0].replace(/^\/?api\/?/, '');
        const section = cleanPath.split('/')[0];
        if (section) {
            clearApiCache(section);
        }
    } else if (options.cache !== false) {
        const now = Date.now();
        const ttl = options.ttl || 15000; // 15-second default cache for instant tab transitions
        if (requestCache.has(fullUrl)) {
            const cached = requestCache.get(fullUrl);
            if (now - cached.timestamp < ttl) {
                return cached.result;
            }
            requestCache.delete(fullUrl);
        }

        if (inFlightRequests.has(fullUrl)) {
            return inFlightRequests.get(fullUrl);
        }
    }

    const { params, cache, ttl, ...fetchOptions } = options;

    const headers = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers || {}),
    };

    const config = {
        ...fetchOptions,
        headers,
        credentials: fetchOptions.credentials ?? 'include',
    };

    const fetchPromise = executeFetch(fullUrl, config, url)
        .then((result) => {
            if (isGet && cache !== false) {
                requestCache.set(fullUrl, { result, timestamp: Date.now() });
            }
            return result;
        })
        .finally(() => {
            inFlightRequests.delete(fullUrl);
        });

    if (isGet && cache !== false) {
        inFlightRequests.set(fullUrl, fetchPromise);
    }

    return fetchPromise;
}

const api = {
    get: (url, config) => request(url, { ...config, method: 'GET' }),
    post: (url, data, config) => request(url, { ...config, method: 'POST', body: JSON.stringify(data) }),
    put: (url, data, config) => request(url, { ...config, method: 'PUT', body: JSON.stringify(data) }),
    patch: (url, data, config) => request(url, { ...config, method: 'PATCH', body: JSON.stringify(data) }),
    delete: (url, config) => request(url, { ...config, method: 'DELETE' }),
    clearCache: clearApiCache,
};

export default api;
