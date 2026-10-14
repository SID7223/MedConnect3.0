This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

**No new Expo packages — see `NO-EXPO.md`.** Never run `npx expo install`, never add `expo-*` dependencies. Native features use React Native core APIs or hand-written Android code under `android/`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo or React Native API (the app already ships Expo Router and the Expo CLI scripts):

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo start   # start the dev server (existing project toolchain)
npx expo lint     # lint
npx tsc --noEmit  # typecheck
```

Run lint and typecheck before declaring any task done.

## Building

The Android release APK is built locally with Gradle (no EAS, no cloud):

```bash
cd mobile\android
.\gradlew.bat assembleRelease --console=plain
# APK → mobile\android\app\build\outputs\apk\release\app-release.apk
```

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Rules

- The `android/` tree is hand-maintained in this project (`SplashActivity`, `MainApplication` + native modules, `MedHaptics*`, themes/styles, manifest). Do **not** run `npx expo prebuild` — it regenerates `android/` and wipes those edits. iOS is not built locally; keep any iOS configuration in `app.json`.
- Do **not** add Expo packages (`npx expo install`, `expo-*` deps) or other dependency additions without asking — prefer React Native core or a small native module. Details and the native haptics example: `NO-EXPO.md`.
