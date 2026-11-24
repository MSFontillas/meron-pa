# Meron Pa?

A simple web app for tracking groceries and household supplies at home, and what to buy.
Made for Filipino households: barcode scanning, "name it once" for products no database knows,
palengke quick-add, and a shared list with no sign-up.

- **At Home**: what you have, with + / − and "Ran out".
- **Shopping List**: tick items as you shop; ticked items wait in "In my basket" (tap again to undo) until you put them away.
- **Scan**: reads EAN/UPC barcodes with the phone camera. Names come from Open Food Facts, Open Beauty Facts and Open Products Facts; unknown products are named once and remembered by your home.
- **Share list**: a link or QR code. Anyone with it can see and change the list. No accounts.

Works offline after the first open. Installs from the browser ("Add to Home Screen").

## How it's built

Vite + Preact + TypeScript, installable web app (vite-plugin-pwa), Firebase Firestore with anonymous sign-in
(invisible; no account) and offline cache, hosted free on GitHub Pages.

Each phone gets a random 128-bit "home" ID. Sharing sends that ID in the link after `#`, so it never reaches the web host.
`firestore.rules` only allows signed-in phones to reach a home whose exact ID they know, never to list homes, and checks every field.

## One-time setup (owner)

1. **Firebase** (free Spark plan, no card needed)
   1. Go to console.firebase.google.com → **Create a project** (Google Analytics not needed).
   2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**.
   3. **Build → Firestore Database → Create database**, location **asia-southeast1 (Singapore)**, start in production mode.
   4. **Firestore → Rules**: paste the contents of `firestore.rules` and **Publish**.
   5. **Project settings → Your apps → Web (</>)**: register an app (no hosting). Copy `apiKey`, `authDomain`, `projectId`, `appId`.
      These values are public by design; the rules protect the data.
2. **GitHub**
   1. Repository **Settings → Secrets and variables → Actions → Variables**: add
      `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`.
   2. **Settings → Pages → Source: GitHub Actions**.
   3. Push to `main`. The app appears at `https://<user>.github.io/<repo>/`.
3. **Firebase → Authentication → Settings → Authorized domains**: add `<user>.github.io`.

## Develop

```bash
npm install
npx firebase emulators:start --only firestore,auth --project demo-grocery   # terminal 1
npm run dev                                                                  # terminal 2, uses the emulators
```

Tests: `npm test` (unit), `npm run test:rules` (security rules, needs Java), `npm run test:e2e` (browser, fake camera).

## Rename the app

Change `APP_NAME` in `src/config.ts` and `name` / `short_name` in `vite.config.ts`.
