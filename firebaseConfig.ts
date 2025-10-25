import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCXQ4q3E_GaMmpqnAyFy_qHZKoB9wZhKW8",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "olinxra-app-1a027.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "olinxra-app-1a027",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "olinxra-app-1a027.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "517113888972",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:517113888972:web:4e7b7eb8d5984f9b3dc269"
};

const app = initializeApp(firebaseConfig);

// Try to initialize Firebase Auth with React Native persistence (AsyncStorage)
// if the optional package is installed. This avoids the runtime warning and
// persists anonymous sign-in between sessions. If the package is not
// available (e.g., web builds), fall back to getAuth(app).
let auth: Auth;
try {
  // Use dynamic require so this file works both on web and RN environments
  // where @react-native-async-storage/async-storage may not be installed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const authModule = require('firebase/auth');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RNAsyncStorage = require('@react-native-async-storage/async-storage');
  if (authModule && authModule.initializeAuth && authModule.getReactNativePersistence) {
    auth = authModule.initializeAuth(app, { persistence: authModule.getReactNativePersistence(RNAsyncStorage) });
  } else {
    auth = getAuth(app);
  }
} catch (e) {
  // If anything fails (module not present, etc.), fall back to default getAuth
  // and let the app run. Intentionally silent to avoid auth-related logs/alerts
  // while focusing on rendering correctness.
  auth = getAuth(app);
}

export { auth };