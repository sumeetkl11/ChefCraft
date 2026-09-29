import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initWebVitals } from './utils/webVitals.js'
import logger from './utils/logger.js'

import { GoogleOAuthProvider } from '@react-oauth/google'

// Start performance monitoring immediately
initWebVitals();
logger.info('App initialized', { version: import.meta.env.VITE_APP_VERSION ?? 'dev' });

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'placeholder-google-client-id';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)

