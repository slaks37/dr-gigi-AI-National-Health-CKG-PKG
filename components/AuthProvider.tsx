'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, auth, signInWithPopup, googleProvider, signOut as firebaseSignOut, onAuthStateChanged } from '../app/lib/firebase';
import { syncUserProfileToDb } from '../app/lib/db';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: 'admin' | 'doctor' | 'patient' | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'doctor' | 'patient' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setRole(null);
      setLoading(true);
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdTokenResult(true);
          if (auth.currentUser?.uid !== currentUser.uid) return;
          const trustedRole = token.claims.role === 'admin' || token.claims.role === 'doctor' ? token.claims.role : 'patient';
          setRole(trustedRole);
          await syncUserProfileToDb({ uid: currentUser.uid });
        } catch {
          setRole('patient');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, role, signIn, signOut }}>
      <React.Fragment key={user?.uid || "guest"}>{children}</React.Fragment>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
