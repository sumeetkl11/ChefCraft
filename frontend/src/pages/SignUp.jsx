import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ChefHat, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import SocialAuthButtons from '../components/SocialAuthButtons';

const SignUp = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const result = await register(name, email, password);

        if (result.success) {
            toast.success('Account created successfully!');
            navigate('/dashboard');
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
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join a social cooking space designed to look premium and move fast.</p>
                </div>

                {/* Social Logins */}
                <SocialAuthButtons mode="signup" />

                <div className="auth-separator">
                    <span>or sign up with email</span>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="name">Full Name</label>
                        <div className="auth-input-wrap">
                            <User className="auth-input-icon h-5 w-5" />
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="pl-11 pr-4 py-3"
                                placeholder="John Doe"
                                required
                                autoComplete="name"
                            />
                        </div>
                    </div>

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
                                minLength={6}
                                autoComplete="new-password"
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
                        <p className="auth-note">Must be at least 6 characters.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="cta-button auth-submit disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="auth-switch">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </div>
        </div>
    );
};

export default SignUp;

