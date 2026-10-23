import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { initializeSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export { AuthContext };

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const isMountedRef = useRef(true);
    const socketTaskRef = useRef({ id: null, type: null });

    const cancelScheduledSocketInit = useCallback(() => {
        const current = socketTaskRef.current;
        if (!current.id) return;
        if (current.type === 'idle' && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
            window.cancelIdleCallback(current.id);
        } else if (current.type === 'timeout') {
            clearTimeout(current.id);
        }
        socketTaskRef.current = { id: null, type: null };
    }, []);

    const scheduleSocketInit = useCallback(() => {
        cancelScheduledSocketInit();
        const runSocketInit = () => {
            socketTaskRef.current = { id: null, type: null };
            if (!isMountedRef.current) return;
            void initializeSocket().catch((err) => console.warn('Socket background init error:', err));
        };

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(runSocketInit, { timeout: 1500 });
            socketTaskRef.current = { id: idleId, type: 'idle' };
        } else {
            const timerId = setTimeout(runSocketInit, 150);
            socketTaskRef.current = { id: timerId, type: 'timeout' };
        }
    }, [cancelScheduledSocketInit]);

    const prefetchCoreData = useCallback(() => {
        void api.get('/user/dashboard-summary', { ttl: 60000 }).catch(() => {});
        void api.get('/pantry', { ttl: 60000 }).catch(() => {});
        void api.get('/recipes', { ttl: 60000 }).catch(() => {});
    }, []);

    useEffect(() => {
        isMountedRef.current = true;

        const checkAuth = async () => {
            try {
                // Concurrently prefetch Dashboard summary & primary tab data in parallel with /api/auth/me
                if (typeof window !== 'undefined' && !['/login', '/signup'].includes(window.location.pathname)) {
                    prefetchCoreData();
                }

                const response = await api.get('/auth/me');
                if (!isMountedRef.current) return;

                if (response.data.success) {
                    const { user } = response.data.data;
                    setUser(user);
                    scheduleSocketInit();
                } else {
                    setUser(null);
                }
            } catch (error) {
                if (!isMountedRef.current) return;
                console.log('No active session');
                setUser(null);
            } finally {
                if (isMountedRef.current) {
                    setLoading(false);
                }
            }
        };

        checkAuth();

        return () => {
            isMountedRef.current = false;
            cancelScheduledSocketInit();
        };
    }, [scheduleSocketInit, cancelScheduledSocketInit, prefetchCoreData]);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { user, token } = response.data?.data || {};

            if (token) {
                localStorage.setItem('token', token);
            }

            setUser(user);
            prefetchCoreData();
            scheduleSocketInit();

            return { success: true };
        } catch (error) {
            const errorMessage =
                error.response?.data?.message ||
                error.response?.data?.error?.message ||
                error.message ||
                'Login failed';
            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const register = async (name, email, password) => {
       try {
            const response = await api.post('/auth/signup', { name, email, password });
            const { user, token } = response.data?.data || {};

            if (token) {
                localStorage.setItem('token', token);
            }

            setUser(user);
            prefetchCoreData();
            scheduleSocketInit();

            return { success: true };

       } catch (error) {
            const errorMessage =
                error.response?.data?.message ||
                error.response?.data?.error?.message ||
                error.message ||
                'Registration failed';
            return {
                success: false,
                error: errorMessage
            };
       }
    };

    const googleLogin = async (credential) => {
        try {
            const response = await api.post('/auth/google', { credential });
            const { user, token } = response.data?.data || {};

            if (token) {
                localStorage.setItem('token', token);
            }

            setUser(user);
            prefetchCoreData();
            scheduleSocketInit();

            return { success: true };
        } catch (error) {
            const errorMessage =
                error.response?.data?.message ||
                error.response?.data?.error?.message ||
                error.message ||
                'Google login failed';
            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const logout = async () => {
        cancelScheduledSocketInit();
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('token');
            api.clearCache();
            setUser(null);
            disconnectSocket();
        }
    };

    const updateUser = (updates) => {
        setUser((current) => {
            const nextUser = { ...current, ...updates };
            return nextUser;
        });
    };

    const value = {
        user,
        loading,
        login,
        register,
        googleLogin,
        logout,
        updateUser,
        isAuthenticated: !!user
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
