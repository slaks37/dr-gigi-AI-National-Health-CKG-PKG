'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, auth, signInWithPopup, googleProvider, signOut as firebaseSignOut, onAuthStateChanged } from '../app/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../app/lib/firebase';
import { syncUserProfileToDb, recordAppUsage } from '../app/lib/db';

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
      setUser(currentUser);
      if (currentUser) {
        // Fetch or create user in Firestore
        try {
          const isSuperAdmin = currentUser.email?.trim().toLowerCase() === 'stefenlaksana.sl@gmail.com';
          
          // Optimistically set super admin role
          if (isSuperAdmin) {
            setRole('admin');
          }

          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            let currentRole = userSnap.data().role;
            if (isSuperAdmin && currentRole !== 'admin') {
              currentRole = 'admin';
              try {
                await setDoc(userRef, { role: 'admin' }, { merge: true });
              } catch(e) {
                console.error("Failed to update role:", e);
              }
            }
            if (!isSuperAdmin) setRole(currentRole);
          } else {
            // New user, determine default role based on email or default to patient
            const defaultRole = isSuperAdmin ? 'admin' : 'patient';
            
            try {
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                role: defaultRole,
                createdAt: new Date().toISOString()
              });
            } catch(e) {
              console.error("Failed to create user:", e);
            }
            const effectiveRole = isSuperAdmin ? 'admin' : (userSnap.exists() ? userSnap.data().role : defaultRole);
            if (!isSuperAdmin) setRole(effectiveRole);

            // Persist user and session to PostgreSQL Database
            if (currentUser.email) {
              syncUserProfileToDb({
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                role: effectiveRole || 'patient',
              }).catch(console.warn);

              recordAppUsage('auth', 'USER_SESSION_STARTED', {
                email: currentUser.email,
                displayName: currentUser.displayName,
              }).catch(console.warn);
            }
          }
        } catch (error) {
          console.error("Error setting up user role:", error);
          // If auth fails and they are super admin, keep admin role. Otherwise fallback to patient
          const isSuperAdmin = currentUser.email?.trim().toLowerCase() === 'stefenlaksana.sl@gmail.com';
          setRole(isSuperAdmin ? 'admin' : 'patient');
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
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
