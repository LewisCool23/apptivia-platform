
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  normalizeRole,
  getPermissionOverrides,
  setPermissionOverrides,
  loadPermissionOverridesFromDb,
  savePermissionOverridesToDb,
  getEffectivePermissions,
  hasPermission as hasPermissionCheck
} from './permissions';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [permissionsVersion, setPermissionsVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // DB-sourced overrides (null = not yet loaded; fall back to localStorage cache)
  const [dbOverrides, setDbOverrides] = useState(null);

  // ── Session management via Supabase onAuthStateChange ──────────────────────
  // This is the authoritative source of auth state. It fires on:
  //  • Initial page load  (INITIAL_SESSION)
  //  • Sign in           (SIGNED_IN)
  //  • Token refresh     (TOKEN_REFRESHED) — keeps the user logged in as JWT renews
  //  • Sign out / expiry (SIGNED_OUT)      — clears state automatically
  useEffect(() => {
    // Seed initial state from the existing session (avoids flash on reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUser(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setProfileLoaded(false);
        setDbOverrides(null);
        localStorage.removeItem('apptivia_user'); // clean up legacy key
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // login() — kept for backward compatibility with Login.jsx.
  // onAuthStateChange fires automatically after signInWithPassword,
  // so this is mostly a fallback state setter.
  const login = (userData) => {
    setUser(userData);
  };

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT handler clears user/profile/dbOverrides
  }, []);

  const updateUser = useCallback((updatedData) => {
    setUser((prev) => prev ? { ...prev, ...updatedData } : prev);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setProfileLoaded(true);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error) {
      setProfile(data);
    } else {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
    setProfileLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    setProfileLoaded(false);
    refreshProfile();
  }, [refreshProfile]);

  // Load permission overrides from DB whenever the logged-in user changes.
  // localStorage is used for an instant first-render, then replaced by the DB value.
  useEffect(() => {
    if (!user?.id) {
      setDbOverrides(null);
      return;
    }
    loadPermissionOverridesFromDb(user.id).then((overrides) => {
      setDbOverrides(overrides);
      setPermissionOverrides(user.id, overrides);
    }).catch(() => {
      setDbOverrides(getPermissionOverrides(user.id));
    });
  }, [user?.id]);

  const role = useMemo(() => normalizeRole(profile?.role || user?.role), [profile?.role, user?.role]);
  const permissionOverrides = useMemo(
    () => dbOverrides !== null ? dbOverrides : getPermissionOverrides(user?.id),
    [dbOverrides, user?.id, permissionsVersion]
  );
  const effectivePermissions = useMemo(
    () => getEffectivePermissions({
      role,
      permissionOverrides,
      explicitPermissions: Array.isArray(profile?.permissions) ? profile.permissions : []
    }),
    [role, permissionOverrides, profile?.permissions]
  );

  const hasPermission = useCallback(
    (permissionKey) => hasPermissionCheck(effectivePermissions, permissionKey),
    [effectivePermissions]
  );

  const updatePermissionOverridesForUser = useCallback((userId, overrides) => {
    setPermissionOverrides(userId, overrides);
    setPermissionsVersion((prev) => prev + 1);

    const orgId = profile?.organization_id;
    savePermissionOverridesToDb(userId, orgId, overrides).catch((err) => {
      console.error('[AuthContext] Failed to save permission overrides to DB:', err);
    });

    if (user?.id && userId === user.id) {
      setDbOverrides(overrides);
      refreshProfile();
    }
  }, [user?.id, profile?.organization_id, refreshProfile]);

  const isAuthenticated = !!(user && user.id && user.email);

  const value = {
    user,
    profile,
    profileLoaded,
    role,
    permissions: effectivePermissions,
    hasPermission,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    refreshProfile,
    updatePermissionOverridesForUser
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
