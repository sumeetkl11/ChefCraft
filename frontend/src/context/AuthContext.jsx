import { createContext, useContext, useState, useEffect } from 'react';
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

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await api.get('/auth/me');
                if (response.data.success) {
                    const { user } = response.data.data;
                    setUser(user);
                    void initializeSocket().catch((err) => console.warn('Socket background init error:', err));
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.log('No active session');
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { user } = response.data.data;

            setUser(user);
            void initializeSocket().catch((err) => console.warn('Socket background init error:', err));

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Login failed'
            };
        }
    };

    const register = async (name, email, password) => {
       try {
            const response = await api.post('/auth/signup', { name, email, password });
            const { user } = response.data.data;

            setUser(user);
            void initializeSocket().catch((err) => console.warn('Socket background init error:', err));

            return { success: true };

       } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || 'Registration failed'
        };
       }
    };

    const googleLogin = async (credential) => {
        try {
            const response = await api.post('/auth/google', { credential });
            const { user } = response.data.data;

            setUser(user);
            void initializeSocket().catch((err) => console.warn('Socket background init error:', err));

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || 'Google login failed'
            };
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
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
