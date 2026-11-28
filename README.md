# Meron Pa?

A simple web app for tracking groceries and household supplies at home, and what to buy.
Made for Filipino households: barcode scanning, "name it once" for products no database knows,
palengke quick-add, and a shared list with no sign-up.

- **At Home**: what you have, with + / − and "Ran out".
- **Shopping List**: tick items as you shop; ticked items wait in "In my basket" (tap again to undo) until you put them away.
- **Scan**: reads EAN/UPC barcodes with the phone camera. Names come first from the app's own catalog (works offline), then from Open Food Facts, Open Beauty Facts and Open Products Facts; unknown products are named once and remembered by your home.
- **Share list**: a link or QR code. Anyone with it can see and change the list. No accounts.

Works offline after the first open. Installs from the browser ("Add to Home Screen").

## How it's built

Vite + Preact + TypeScript, installable web app (vite-plugin-pwa), Firebase Firestore with anonymous sign-in
(invisible; no account) and offline cache, hosted free on GitHub Pages.

Each phone gets a random 128-bit "home" ID. Sharing sends that ID in the link after `#`, so it never reaches the web host.
`firestore.rules` only allows signed-in phones to reach a home whose exact ID they know, never to list homes, and checks every field.

## Product catalog (owner)

`data/` holds our own barcode list: a weekly copy of the Open Food Facts products sold in the Philippines
(`data/off/`, refreshed by the "Update product catalog" workflow) plus your own rows in `data/products.csv`
(they win over the copy). Details and columns: `data/README.md`.

- **Add a product**: open `data/products.csv` on GitHub, click the pencil, add a line such as
  `4800016644801,Piattos Cheese,Jack n Jill,45 g,Food & drinks,yes`, then Commit. A wrong row fails the build and names the line.
- **Give products back to Open Food Facts** (optional): create a free account on openfoodfacts.org, then add the repository
  secrets `OFF_USER` and `OFF_PASSWORD`. Rows with `give_back` = `yes` that OFF lacks are sent once (recorded in `data/sent-to-off.txt`).
  Without the secrets the step is a dry run.
- Locally: `npm run catalog:fetch` (slow, about 10 minutes, respects OFF's rate limit) and `npm run catalog:build`.

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
4. **App Check** (stops scripts from using up the free daily quota)
   1. Google Cloud console → **Security → Fraud Defense** (console.cloud.google.com/security/recaptcha), project = your Firebase project. Enable the reCAPTCHA Enterprise API if asked. If it asks for billing, stop and read the Pricing section on firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider first.
   2. Create a key: platform **Web**, domain `<user>.github.io`, score-based (no checkbox). Copy the **key ID**.
   3. Firebase console → **Security → App Check → Apps** → your web app → **reCAPTCHA Enterprise** → paste the key ID, token time to live **1 day**, Save.
   4. GitHub → Settings → Secrets and variables → Actions → Variables: add `RECAPTCHA_SITE_KEY` = the key ID. Re-run the workflow.
   5. Use the app on a phone for a few minutes, then **App Check → APIs → Cloud Firestore**: when nearly all requests show as verified, click **Enforce**.

## Develop

```bash
npm install
npx firebase emulators:start --only firestore,auth --project demo-grocery   # terminal 1
npm run dev                                                                  # terminal 2, uses the emulators
```

Tests: `npm test` (unit), `npm run test:rules` (security rules, needs Java), `npm run test:e2e` (browser, fake camera).

## Rename the app

Change `APP_NAME` in `src/config.ts` and `name` / `short_name` in `vite.config.ts`.

## Install on a phone (free)

- **iPhone:** open the site in Safari, tap Share, then **Add to Home Screen**.
- **Android app (APK):** open the repo's **Releases** page on your phone, download the latest `Meron-Pa-*.apk`, open it and allow installing from your browser when asked. Play Protect may say the developer is unknown; that is expected for an app that is not in the Play Store. The app opens the live website full screen, so website updates reach it without a new download.

### Publishing the Android app (maintainer)

1. Add two repository secrets (Settings, Secrets and variables, Actions): `ANDROID_KEYSTORE_B64` (the signing key as one line of base64) and `ANDROID_KEYSTORE_PASSWORD`. Keep a private backup of the key: with a new key, people must uninstall the app to update.
2. For the app to hide the browser address bar, the site must vouch for the app: create a repo named `<your-user>.github.io` that serves `.well-known/assetlinks.json` (it holds only the public SHA-256 fingerprint of the key). Without it the app still works, with a thin address bar.
3. Push a tag: `git tag v1.0.0 && git push origin v1.0.0`. The **Android app** workflow builds, signs and attaches `Meron-Pa-v1.0.0.apk` to a new Release.

Other pushes that touch `twa-manifest.json` or the workflow run a test build with a throwaway key and publish nothing.

Later, when Google's developer verification reaches your country (2027), a one-time US$25 Play Console account lets you ship the same app through Google Play.
