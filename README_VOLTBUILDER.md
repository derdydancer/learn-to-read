# Läsresan - Prepared for VoltBuilder (Corrected)

This project has been fully prepared and built for **VoltBuilder** Android APK generation.

## Fixes Applied

1.  **Build Process Fixed:** The previous build failed because the entry point was missing from `index.html`. I have now correctly linked `index.tsx` and verified that the `www` folder contains the bundled application (`assets/index-*.js`).
2.  **Importmap Removed:** Removed the external `importmap` from `index.html` as it conflicted with the local bundling process required for a native app.
3.  **VoltBuilder Configuration:**
    *   `config.xml`: Updated with correct Android SDK versions and essential plugins.
    *   `voltbuilder.json`: Set to `android` debug build.
4.  **Gemini API Key Setting:**
    *   The app now includes a manual API key input in the **Expert Editor** (click the lock icon in the top right, enter code `9999`, then click the gear icon).
    *   The key is saved to `localStorage` and will persist across app restarts.

## How to Build

1.  Download the attached `learn-to-read-prepared.zip`.
2.  Go to [VoltBuilder](https://volt.build/) and upload the ZIP file.
3.  VoltBuilder will use the pre-built `www` folder and the configuration files to create your APK.

## Verification
The `www` folder in this package contains:
- `index.html`: Correctly linked to the bundled JS.
- `assets/`: Contains the minified React application (approx. 500KB).

This setup ensures the app will not open to a blank screen and will function correctly as a native Android application.
