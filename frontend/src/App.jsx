import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ClickSpark from './components/ClickSpark';
import ErrorBoundary from './components/ErrorBoundary';

import RouteSceneAnimator from './components/RouteSceneAnimator';
import { useAuth } from './context/AuthContext';
import './App.css';

// Core primary routes imported eagerly for 0ms route transition (no Suspense waterfall)
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Pantry from './pages/Pantry';
import MyRecipes from './pages/MyRecipes';
import ShoppingList from './pages/ShoppingList';
import Settings from './pages/Settings';
import MealPlanner from './pages/MealPlanner';
import SocialPage from './pages/SocialPage';

// Secondary & protected sandbox routes lazy-loaded
const RecipeGenerator = lazy(() => import('./pages/RecipeGenerator'));
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'));
const ChallengesPage = lazy(() => import('./pages/ChallengesPage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const MarketplaceHub = lazy(() => import('./pages/Marketplace/MarketplaceHub'));
const CreateListing = lazy(() => import('./pages/Marketplace/CreateListing'));

function OwnProfileRoute() {
  const { user } = useAuth();

  if (!user?.id) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to={`/profile/${user.id}`} replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <main id="main-content" className="app-shell max-w-8xl mx-auto">
        <AuthProvider>
          <Router>

            <div className="device-shell">
              <ClickSpark className="app-frame">
                <RouteSceneAnimator />
                <ErrorBoundary>
                  <Suspense fallback={
                    <div className="flex items-center justify-center min-h-[60vh]">
                      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  }>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<SignUp />} />

                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />

                      <Route path="/pantry" element={<ProtectedRoute><Pantry /></ProtectedRoute>} />
                      <Route path="/generate" element={<ProtectedRoute><RecipeGenerator /></ProtectedRoute>} />
                      <Route path="/recipes" element={<ProtectedRoute><MyRecipes /></ProtectedRoute>} />
                      <Route path="/recipes/:id" element={<ProtectedRoute><RecipeDetail /></ProtectedRoute>} />
                      <Route path="/meal-plan" element={<ProtectedRoute><MealPlanner /></ProtectedRoute>} />
                      <Route path="/shopping-list" element={<ProtectedRoute><ShoppingList /></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                      <Route path="/social" element={<ProtectedRoute><SocialPage /></ProtectedRoute>} />
                      <Route path="/challenges" element={<ProtectedRoute><ChallengesPage /></ProtectedRoute>} />
                      <Route path="/collections" element={<ProtectedRoute><CollectionsPage /></ProtectedRoute>} />
                      <Route path="/collections/:collectionId" element={<ProtectedRoute><CollectionDetailPage /></ProtectedRoute>} />
                      <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                      <Route path="/marketplace" element={<ProtectedRoute><MarketplaceHub /></ProtectedRoute>} />
                      <Route path="/marketplace/new" element={<ProtectedRoute><CreateListing /></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute><OwnProfileRoute /></ProtectedRoute>} />
                      <Route path="/profile/:userId" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </ClickSpark>
            </div>
          </Router>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(255, 255, 255, 0.82)',
              color: '#101828',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              borderRadius: '1.2rem',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)'
            },
            success: {
              iconTheme: {
                primary: '#784BA0',
                secondary: '#ffffff'
              }
            },
            error: {
              iconTheme: {
                primary: '#FF3CAC',
                secondary: '#ffffff'
              }
            }
          }}
        />
        </AuthProvider>
      </main>
    </ErrorBoundary>
  );
}

export default App;
