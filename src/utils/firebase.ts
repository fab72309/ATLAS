import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Warn early if some env variables are missing to simplify setup (measurementId is optional).
const requiredEnv: Array<keyof FirebaseOptions> = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];
const missingEnv = requiredEnv.filter((key) => !(firebaseConfig as Record<string, string | undefined>)[key]);
if (missingEnv.length) {
  // eslint-disable-next-line no-console
  console.warn('[Firebase] Variables manquantes:', missingEnv.join(', '));
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Wait until Firebase Auth has emitted the initial auth state (user or null).
// This is useful to avoid Firestore reads before auth is initialized.
export const authReady = new Promise<void>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, () => {
    unsubscribe();
    resolve();
  });
});

// Enable offline persistence
try {
  enableIndexedDbPersistence(db);
} catch (err: unknown) {
  const code = (typeof err === 'object' && err !== null && 'code' in err)
    ? String((err as { code?: unknown }).code)
    : '';

  if (code === 'failed-precondition') {
    console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (code === 'unimplemented') {
    console.warn("The current browser doesn't support persistence.");
  } else {
    console.warn('Failed to enable persistence:', err);
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
