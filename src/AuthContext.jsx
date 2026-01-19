import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for stored session on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('apptivia_user');
    console.log('[AuthContext] Loaded from localStorage:', storedUser);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        console.log('[AuthContext] Set user from localStorage:', JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('apptivia_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('apptivia_user', JSON.stringify(userData));
    console.log('[AuthContext] Login called. User set and saved to localStorage:', userData);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('apptivia_user');
    console.log('[AuthContext] Logout called. User cleared and removed from localStorage.');
  };

  const updateUser = (updatedData) => {
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('apptivia_user', JSON.stringify(updatedUser));
    console.log('[AuthContext] updateUser called. User updated and saved to localStorage:', updatedUser);
  };

  useEffect(() => {
    console.log('[AuthContext] user state changed:', user);
    console.log('[AuthContext] isAuthenticated:', !!(user && user.id && user.email));
  }, [user]);

  const isAuthenticated = !!(user && user.id && user.email);
  useEffect(() => {
    console.log('[AuthContext] (on mount) user:', user);
    console.log('[AuthContext] (on mount) isAuthenticated:', isAuthenticated);
  }, []);
  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
