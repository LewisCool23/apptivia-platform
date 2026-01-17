import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LogOut } from 'lucide-react';

const ApptivPlatformWithAuth = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Welcome, {user?.name || 'User'}!</h2>
          <button
            className="text-red-500 hover:text-red-700 flex items-center"
            onClick={() => setShowLogoutConfirm(true)}
            title="Logout"
          >
            <LogOut className="mr-1" /> Logout
          </button>
        </div>
        <div className="mb-4">
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Role:</strong> {user?.role}</p>
          <p><strong>Department:</strong> {user?.department}</p>
          <p><strong>Phone:</strong> {user?.phone}</p>
          <p><strong>Level:</strong> {user?.level}</p>
        </div>
        <div>
          <p className="text-gray-600">(Your dashboard content goes here...)</p>
        </div>
      </div>
      {showLogoutConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <p className="mb-4">Are you sure you want to log out?</p>
            <div className="flex justify-end space-x-4">
              <button
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={handleLogout}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApptivPlatformWithAuth;
