import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import { supabase, getUserProfile } from '../supabaseClient';

// Define types for user and profile
type User = {
  id: string;
  email: string;
  // add other fields as needed
};
type Profile = {
  id: string;
  name?: string;
  role: string;
  // add other fields as needed
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  setProfile: Dispatch<SetStateAction<Profile | null>>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user as User);
        const profileData = await getUserProfile();
        setProfile(profileData as Profile);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user as User | null);
      if (user) {
        const profileData = await getUserProfile();
        setProfile(profileData as Profile);
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, setUser, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}