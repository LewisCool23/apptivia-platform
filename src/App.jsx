
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Login from './Login';
import ApptiviaScorecard from './ApptiviaScorecard';
import ProtectedRoute from './ProtectedRoute';
import Coach from './pages/Coach';
import Contests from './pages/Contests';
import Analytics from './pages/Analytics';
import Systems from './pages/Systems';
import PermissionsTeams from './pages/PermissionsTeams';
import Profile from './pages/Profile';
import CoachingPlans from './pages/CoachingPlans';
import Integrations from './pages/Integrations';
import OrganizationSettings from './pages/OrganizationSettings';
import LandingPage from './pages/LandingPage';
import { supabaseConfigMissing } from './supabaseClient';
import ErrorBoundary from './components/ErrorBoundary';

const AppRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null; // or a spinner
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={React.createElement(require('./pages/ForgotPassword').default)} />
      <Route path="/update-password" element={React.createElement(require('./pages/UpdatePassword').default)} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute requiredPermissions={['view_dashboard']}>
            <ApptiviaScorecard initialPage="home" />
          </ProtectedRoute>
        } 
      />
        <Route path="/coach"
          element={
            <ProtectedRoute requiredPermissions={['view_coach']}>
              <Coach />
            </ProtectedRoute>
          }
        />
        <Route path="/contests"
          element={
            <ProtectedRoute requiredPermissions={['view_contests']}>
              <Contests />
            </ProtectedRoute>
          }
        />
        <Route path="/analytics"
          element={
            <ProtectedRoute requiredPermissions={['view_analytics']}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route path="/systems"
          element={
            <ProtectedRoute requiredPermissions={['view_systems']}>
              <Systems />
            </ProtectedRoute>
          }
        />
        <Route path="/permissions-teams"
          element={
            <ProtectedRoute requiredPermissions={['view_systems']}>
              <PermissionsTeams />
            </ProtectedRoute>
          }
        />
        <Route path="/profile"
          element={
            <ProtectedRoute requiredPermissions={['view_profile']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/coaching-plans"
          element={
            <ProtectedRoute requiredPermissions={['view_coach']}>
              <CoachingPlans />
            </ProtectedRoute>
          }
        />
        <Route path="/integrations"
          element={
            <ProtectedRoute requiredPermissions={['view_systems']}>
              <Integrations />
            </ProtectedRoute>
          }
        />
        <Route path="/organization-settings"
          element={
            <ProtectedRoute requiredPermissions={['view_systems']}>
              <OrganizationSettings />
            </ProtectedRoute>
          }
        />
      <Route path="/app" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            {supabaseConfigMissing && (
              <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-xs px-4 py-2 text-center">
                Supabase is not configured. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY to your .env file, then restart the dev server.
              </div>
            )}
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
