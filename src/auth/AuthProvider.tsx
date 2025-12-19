import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const persistUserMetadata = async (user: User, { isNew }: { isNew: boolean }) => {
  const userRef = doc(db, 'utilisateurs', user.uid);
  const payload: Record<string, unknown> = {
    uid: user.uid,
    email: user.email,
    lastLoginAt: serverTimestamp()
  };

  if (isNew) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(userRef, payload, { merge: true });
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const isFirstLogin = !nextUser.metadata.creationTime || nextUser.metadata.creationTime === nextUser.metadata.lastSignInTime;
        await persistUserMetadata(nextUser, { isNew: isFirstLogin }).catch((err) => {
          console.error('Impossible de persister le profil utilisateur', err);
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn: async (email: string, password: string) => {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await persistUserMetadata(credential.user, { isNew: false });
      return credential.user;
    },
    signUp: async (email: string, password: string) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await persistUserMetadata(credential.user, { isNew: true });
      return credential.user;
    },
    signOut: async () => {
      await firebaseSignOut(auth);
      setUser(null);
    }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
