import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ChefHat, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import SocialAuthButtons from '../components/SocialAuthButtons';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const fromPath = location.state?.from?.pathname || '/dashboard';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const result = await login(email, password);

        if (result.success) {
            toast.success('Welcome back!');
            navigate(fromPath, { replace: true });
        } else {
            toast.error(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <div className="auth-brand">
                    <div className="auth-logo">
                        <ChefHat className="h-8 w-8" />
                    </div>
                    <h1 className="auth-title">Welcome Back</h1>
                    <p className="auth-subtitle">Sign in to continue plating, planning, and posting.</p>
                </div>

                {/* Social Logins */}
                <SocialAuthButtons mode="login" />

                <div className="auth-separator">
                    <span>or sign in with email</span>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <div className="auth-input-wrap">
                            <Mail className="auth-input-icon h-5 w-5" />
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-11 pr-4 py-3"
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <div className="auth-input-wrap">
                            <Lock className="auth-input-icon h-5 w-5" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-11 pr-11 py-3"
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="auth-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="auth-row-options">
                        <label className="auth-checkbox-label">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span>Remember me</span>
                        </label>
                        <Link to="/reset-password" className="auth-link">
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="cta-button auth-submit disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="auth-switch">
                    Don't have an account? <Link to="/signup">Sign up</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;

