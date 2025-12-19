import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyDaXSVEknQ1SwG4I9jxp7czdtPh_94yAWA',
  authDomain: 'atlas-23eb8.firebaseapp.com',
  projectId: 'atlas-23eb8',
  storageBucket: 'atlas-23eb8.firebasestorage.app',
  messagingSenderId: '550508514553',
  appId: '1:550508514553:web:623d0ce8621c30002ce628',
  measurementId: 'G-14Q67F4BTF'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Resolve once the initial auth state is known (no implicit anonymous auth)
export const authReady = new Promise<void>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, () => {
    resolve();
    unsubscribe();
  });
});

// Enable offline persistence
try {
  enableIndexedDbPersistence(db);
} catch (err: any) {
  if (err?.code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a a time.');
  } else if (err?.code === 'unimplemented') {
    console.warn('The current browser doesn\'t support persistence.');
  }
}

let analyticsInstance: Analytics | null = null;

export const initAnalytics = async () => {
  if (analyticsInstance) return analyticsInstance;
  if (typeof window === 'undefined') return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn('Firebase Analytics not supported in this environment');
    return null;
  }

  analyticsInstance = getAnalytics(app);
  return analyticsInstance;
};
