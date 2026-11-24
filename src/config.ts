// App name lives here only; rename the app in one place.
export const APP_NAME = "Meron Pa?";

// Firebase web config is public by design (security comes from firestore.rules).
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "demo-grocery.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo-grocery",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "demo-app",
};

// reCAPTCHA v3 site key for Firebase App Check (public). Empty = App Check off (local and tests).
export const appCheckKey: string = import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? "";

// Local development and tests talk to the Firebase emulators.
export const useEmulator = import.meta.env.VITE_USE_EMULATOR === "1" || !import.meta.env.VITE_FIREBASE_PROJECT_ID;
