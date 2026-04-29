
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Login from './Login';
import ApptiviaScorecard from './ApptiviaScorecard';
import ProtectedRoute from './ProtectedRoute';
import { supabaseConfigMissing } from './supabaseClient';
import ErrorBoundary, { PageErrorBoundary } from './components/ErrorBoundary';
import DealCelebration from './components/DealCelebration';

// ── Eagerly-loaded (small, needed immediately) ──────────────────────────────
import LandingPage from './pages/LandingPage';
import AccountSetup from './pages/AccountSetup';
import SignUp from './pages/SignUp';

// ── Public pages (lazily-loaded) ─────────────────────────────────────────────
const PublicIntegrations = React.lazy(() => import('./pages/PublicIntegrations'));
const PrivacyPolicy      = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService     = React.lazy(() => import('./pages/TermsOfService'));
const SecurityPage       = React.lazy(() => import('./pages/Security'));
const PilotApplication   = React.lazy(() => import('./pages/PilotApplication'));

// ── Lazily-loaded pages (split into separate chunks) ────────────────────────
const Coach            = React.lazy(() => import('./pages/Coach'));
const Engage           = React.lazy(() => import('./pages/Engage'));
const Contests         = React.lazy(() => import('./pages/Contests'));
const Analytics        = React.lazy(() => import('./pages/Analytics'));
const Systems          = React.lazy(() => import('./pages/Systems'));
const PermissionsTeams = React.lazy(() => import('./pages/PermissionsTeams'));
const Profile          = React.lazy(() => import('./pages/Profile'));
const CoachingPlans    = React.lazy(() => import('./pages/CoachingPlans'));
const Integrations     = React.lazy(() => import('./pages/Integrations'));
const OrganizationSettings = React.lazy(() => import('./pages/OrganizationSettings'));
const Wallboard        = React.lazy(() => import('./pages/Wallboard'));
const ForgotPassword   = React.lazy(() => import('./pages/ForgotPassword'));
const UpdatePassword   = React.lazy(() => import('./pages/UpdatePassword'));
const PilotDashboard   = React.lazy(() => import('./pages/PilotDashboard'));

// ── Simple page-level loading fallback ──────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-apptivia-paper">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-apptivia-coral border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-apptivia-carbon-400">Loading…</span>
      </div>
    </div>
  );
}

// Convenience wrapper: ProtectedRoute + per-page error boundary
function PBR({ permissions, children }) {
  return (
    <ProtectedRoute requiredPermissions={permissions}>
      <PageErrorBoundary>
        {children}
      </PageErrorBoundary>
    </ProtectedRoute>
  );
}

const AppRoutes = () => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/account-setup" element={<AccountSetup />} />
        <Route path="/public-integrations" element={<PublicIntegrations />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/pilot" element={<PilotApplication />} />
        <Route
          path="/dashboard"
          element={
            <PBR permissions={['view_dashboard']}>
              <ApptiviaScorecard initialPage="home" />
            </PBR>
          }
        />
        <Route path="/coach"
          element={<PBR permissions={['view_coach']}><Coach /></PBR>}
        />
        <Route path="/engage"
          element={<PBR permissions={['view_engage']}><Engage /></PBR>}
        />
        <Route path="/contests"
          element={<PBR permissions={['view_contests']}><Contests /></PBR>}
        />
        <Route path="/analytics"
          element={<PBR permissions={['view_analytics']}><Analytics /></PBR>}
        />
        <Route path="/systems"
          element={<PBR permissions={['view_systems']}><Systems /></PBR>}
        />
        <Route path="/permissions-teams"
          element={<PBR permissions={['view_systems']}><PermissionsTeams /></PBR>}
        />
        <Route path="/profile"
          element={<PBR permissions={['view_profile']}><Profile /></PBR>}
        />
        <Route path="/coaching-plans"
          element={<PBR permissions={['view_coach']}><CoachingPlans /></PBR>}
        />
        <Route path="/integrations"
          element={<PBR permissions={['view_systems']}><Integrations /></PBR>}
        />
        <Route path="/organization-settings"
          element={<PBR permissions={['view_systems']}><OrganizationSettings /></PBR>}
        />
        <Route path="/wallboard"
          element={<PBR permissions={['view_coach']}><Wallboard /></PBR>}
        />
        <Route path="/admin/pilot"
          element={
            <ProtectedRoute requiredRoles={['admin']}>
              <PageErrorBoundary><PilotDashboard /></PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/app" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
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
              <DealCelebration />
            </ErrorBoundary>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}

export default App;
