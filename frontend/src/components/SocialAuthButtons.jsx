import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

const SocialAuthButtons = ({ mode = 'login' }) => {
    const { googleLogin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const fromPath = location.state?.from?.pathname || '/dashboard';

    const handleGoogleSuccess = async (credentialResponse) => {
        if (!credentialResponse?.credential) {
            toast.error('Could not retrieve Google login credentials');
            return;
        }

        const result = await googleLogin(credentialResponse.credential);
        if (result.success) {
            toast.success(mode === 'signup' ? 'Welcome to ChefCraft!' : 'Welcome back!');
            navigate(fromPath, { replace: true });
        } else {
            toast.error(result.error || 'Google login failed');
        }
    };

    return (
        <div className="auth-social-stack">
            {/* Google OAuth Button */}
            <div className="flex justify-center w-full min-h-[44px]">
                <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error('Google Sign-In failed or was cancelled')}
                    theme="outline"
                    size="large"
                    shape="pill"
                    text={mode === 'signup' ? 'signup_with' : 'signin_with'}
                    width="400"
                />
            </div>
        </div>
    );
};

export default SocialAuthButtons;
