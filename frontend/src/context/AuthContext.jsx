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
        // Check if user is already authenticated via httpOnly cookie
        const checkAuth = async () => {
            try {
                const response = await api.get('/auth/me');
                if (response.data.success) {
                    const { user, token } = response.data.data;
                    if (token && token !== 'null' && token !== 'undefined') {
                        localStorage.setItem('token', token);
                    }
                    setUser(user);
                    // Initialize socket connection after user is confirmed
                    await initializeSocket();
                } else {
                    setUser(null);
                    localStorage.removeItem('token');
                }
            } catch (error) {
                // User not authenticated or token expired
                console.log('No active session');
                localStorage.removeItem('token');
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
            const { user, token } = response.data.data;

            if (token) {
                localStorage.setItem('token', token);
            }

            setUser(user);
            
            // Initialize Socket.io connection and await it
            await initializeSocket();

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
            const { user, token } = response.data.data;

            if (token) {
                localStorage.setItem('token', token);
            }
            
            setUser(user);
            
            // Initialize Socket.io connection and await it
            await initializeSocket();
            
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
            const { user, token } = response.data.data;

            if (token) {
                localStorage.setItem('token', token);
            }

            setUser(user);
            await initializeSocket();

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
            localStorage.removeItem('token');
            setUser(null);
            
            // Disconnect Socket.io
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
