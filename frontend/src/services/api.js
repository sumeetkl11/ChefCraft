const getBaseApiUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && !envUrl.includes('localhost:8000') && !envUrl.includes('localhost:5173')) {
        return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
    }
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/api`;
    }
    return '/api';
};

export const API_URL = getBaseApiUrl();

const getBaseSocketUrl = () => {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return API_URL.replace(/\/api\/?$/, '');
};

export const SOCKET_URL = getBaseSocketUrl();

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
        headers: {
            'Content-Type': 'application/json',
            ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        }
    })
        .then(async (res) => {
            if (res.ok) {
                const data = await res.json();
                if (data?.data?.token) {
                    localStorage.setItem('token', data.data.token);
                }
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
const SESSION_CACHE_PREFIX = 'cc_api_cache_v2:';

function getSessionCache(fullUrl, ttl) {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return null;
        const raw = window.sessionStorage.getItem(SESSION_CACHE_PREFIX + fullUrl);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < ttl) {
            return { result: { data: parsed.data, status: 200, headers: new Headers() }, timestamp: parsed.timestamp };
        }
        window.sessionStorage.removeItem(SESSION_CACHE_PREFIX + fullUrl);
    } catch {
        // Ignore sessionStorage errors
    }
    return null;
}

function setSessionCache(fullUrl, data, timestamp) {
    try {
        if (typeof window === 'undefined' || !window.sessionStorage) return;
        const serialized = JSON.stringify({ data, timestamp });
        if (serialized.length < 150000) {
            window.sessionStorage.setItem(SESSION_CACHE_PREFIX + fullUrl, serialized);
        }
    } catch {
        // Ignore quota errors
    }
}

export function clearApiCache(urlPrefix = null) {
    if (!urlPrefix) {
        requestCache.clear();
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
                    const k = window.sessionStorage.key(i);
                    if (k && k.startsWith(SESSION_CACHE_PREFIX)) {
                        window.sessionStorage.removeItem(k);
                    }
                }
            }
        } catch {}
        return;
    }
    for (const key of requestCache.keys()) {
        if (key.includes(urlPrefix)) {
            requestCache.delete(key);
        }
    }
    try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
                const k = window.sessionStorage.key(i);
                if (k && k.startsWith(SESSION_CACHE_PREFIX) && k.includes(urlPrefix)) {
                    window.sessionStorage.removeItem(k);
                }
            }
        }
    } catch {}
}

async function executeFetch(fullUrl, config, url) {
    let response;
    try {
        response = await fetch(fullUrl, config);
    } catch (fetchErr) {
        console.error('[API Connection Error]', fullUrl, fetchErr);
        const err = new Error('Cannot connect to backend server. Please refresh or try again.');
        err.response = { status: 0, data: { message: err.message } };
        throw err;
    }

    if (response.status === 401 &&
        !url.includes('/auth/refresh') &&
        !url.includes('/auth/login') &&
        !url.includes('/auth/signup')) {
        const refreshResult = await tryRefreshToken();
        if (refreshResult.success) {
            const currentToken = localStorage.getItem('token');
            const retryHeaders = {
                ...config.headers,
                ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
            };
            try {
                response = await fetch(fullUrl, { ...config, headers: retryHeaders });
            } catch (retryErr) {
                const err = new Error('Connection lost during token retry');
                err.response = { status: 0, data: { message: err.message } };
                throw err;
            }
        } else {
            localStorage.removeItem('token');
            clearApiCache();
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
        data = await response.json().catch(() => null);
    } else {
        data = await response.text().catch(() => '');
    }

    if (!response.ok) {
        const error = new Error(
            (typeof data === 'object' && data?.message) ||
            (typeof data === 'object' && data?.error?.message) ||
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

    if (!isGet) {
        const cleanPath = url.split('?')[0].replace(/^\/?api\/?/, '');
        const section = cleanPath.split('/')[0];
        if (section) {
            clearApiCache(section);
            if (['pantry', 'recipes', 'meal-plans', 'posts', 'user'].includes(section)) {
                clearApiCache('user/dashboard-summary');
            }
        }
    } else if (options.cache !== false) {
        const now = Date.now();
        const ttl = options.ttl || 60000;
        if (requestCache.has(fullUrl)) {
            const cached = requestCache.get(fullUrl);
            if (now - cached.timestamp < ttl) {
                return cached.result;
            }
            requestCache.delete(fullUrl);
        }

        const sessionCached = getSessionCache(fullUrl, ttl);
        if (sessionCached) {
            requestCache.set(fullUrl, sessionCached);
            return sessionCached.result;
        }

        if (inFlightRequests.has(fullUrl)) {
            return inFlightRequests.get(fullUrl);
        }
    }

    const { params, cache, ttl, ...fetchOptions } = options;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = {
        'Content-Type': 'application/json',
        ...(token && token !== 'null' && token !== 'undefined' ? { 'Authorization': `Bearer ${token}` } : {}),
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
                const ts = Date.now();
                requestCache.set(fullUrl, { result, timestamp: ts });
                setSessionCache(fullUrl, result.data, ts);
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
