# SS ENTERPRISES – ABHA Android App v4.2

This package contains:

1. `android/` — a native Android Studio wrapper for the live SS ENTERPRISES ABHA portal. It has its own application ID, SS ENTERPRISES icon, branded Android splash screen, camera/microphone/location permissions, file chooser, cookies/storage, and back navigation. It does **not** use a third-party demo/trial wrapper.
2. `web/` — the complete v4.1 web/Render project, including the previous server, data, PWA, 38-district, TL hierarchy, location/history, work-update, backup/audit and UI improvements.

## Live portal used by the Android app
`https://ss-enterprises-abha-app-2026.onrender.com/`

If your Render service URL is different, change `appUrl` in `android/app/src/main/java/com/ssenterprises/abha/MainActivity.kt` before building.

## Build
Open the `android` folder in Android Studio and build a signed APK/AAB. The generated APK is independent of any expired app-builder demo.

### Important
The native app is a client for the live portal. Server-side data persistence, authentication, WebRTC/SFU/TURN and Render configuration remain server responsibilities; this package does not falsely claim those services are bundled into the Android binary.
