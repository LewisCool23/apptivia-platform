
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { backendFetch } from './utils/backendFetch';
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
    try { await supabase.auth.signOut(); } catch (err) { console.error('Sign out error:', err); }
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

  // Auto-create profile for new OAuth users (Google, etc.) who bypass /api/auth/signup
  const ensuredProfileRef = useRef(false);
  useEffect(() => {
    if (user?.id && profileLoaded && !profile && !ensuredProfileRef.current) {
      ensuredProfileRef.current = true;
      backendFetch('/api/auth/ensure-profile', undefined, 'POST')
        .then(() => refreshProfile())
        .catch((err) => console.error('[AuthContext] Failed to ensure profile for OAuth user:', err));
    }
    if (!user?.id) ensuredProfileRef.current = false;
  }, [user?.id, profileLoaded, profile, refreshProfile]);

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

  const ROLE_LEVEL_MAP = { admin: 4, manager: 3, coach: 2, power_user: 1 };
  const primaryRole = useMemo(() => normalizeRole(profile?.role || user?.role), [profile?.role, user?.role]);
  const secondaryRole = useMemo(
    () => profile?.secondary_role ? normalizeRole(profile.secondary_role) : null,
    [profile?.secondary_role]
  );
  // Effective role = highest privilege between primary and secondary
  const role = useMemo(() => {
    if (!secondaryRole) return primaryRole;
    return (ROLE_LEVEL_MAP[secondaryRole] || 0) > (ROLE_LEVEL_MAP[primaryRole] || 0)
      ? secondaryRole : primaryRole;
  }, [primaryRole, secondaryRole]);
  const permissionOverrides = useMemo(
    () => dbOverrides !== null ? dbOverrides : getPermissionOverrides(user?.id),
    [dbOverrides, user?.id, permissionsVersion]
  );
  const effectivePermissions = useMemo(
    () => getEffectivePermissions({
      role,
      secondaryRole,
      permissionOverrides,
      explicitPermissions: Array.isArray(profile?.permissions) ? profile.permissions : []
    }),
    [role, secondaryRole, permissionOverrides, profile?.permissions]
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
