import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Loader } from 'lucide-react';

const ProtectedRoute = ({ children, requiredRoles = [], requiredPermissions = [], requireAllPermissions = false }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, role, hasPermission } = useAuth();

  const fallbackRoute = (() => {
    const routes = [
      { path: '/dashboard', permission: 'view_dashboard' },
      { path: '/coach', permission: 'view_coach' },
      { path: '/contests', permission: 'view_contests' },
      { path: '/analytics', permission: 'view_analytics' },
      { path: '/systems', permission: 'view_systems' },
      { path: '/profile', permission: 'view_profile' }
    ];
    const match = routes.find((route) => hasPermission(route.permission));
    return match?.path || null;
  })();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
    if (fallbackRoute && location.pathname !== fallbackRoute) {
      return <Navigate to={fallbackRoute} replace />;
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border rounded-xl shadow-sm p-6 max-w-md text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Access denied</h1>
          <p className="text-sm text-gray-500">You don’t have access to this page.</p>
        </div>
      </div>
    );
  }

  if (requiredPermissions.length > 0) {
    const allowed = requireAllPermissions
      ? requiredPermissions.every((p) => hasPermission(p))
      : requiredPermissions.some((p) => hasPermission(p));
    if (!allowed) {
      if (fallbackRoute && location.pathname !== fallbackRoute) {
        return <Navigate to={fallbackRoute} replace />;
      }
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white border rounded-xl shadow-sm p-6 max-w-md text-center">
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Access denied</h1>
            <p className="text-sm text-gray-500">You don’t have permission to view this page.</p>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
