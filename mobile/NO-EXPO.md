# No Expo packages — native Android instead

**Decision: this app does not add Expo packages for features. Never run `npx expo install`, never add new `expo-*` dependencies (this includes traps like `expo-haptics`).**

Why: the release APK is built locally with Gradle, `android/` is real hand-maintained source, and the Android SDK already provides everything we need. Expo modules add package churn, EAS coupling and autolinking surprises.

## Rules

1. **Do not install packages with `npx expo install`** (or add `expo-*` deps). Not for haptics, not for anything.
2. Prefer React Native core APIs first (`Vibration`, `Share`, `Linking`, …).
3. If a platform API is needed, write a small native module under
   `mobile/android/app/src/main/java/io/medconnect/app/` (Kotlin/Java) and register it in
   `MainApplication.kt` inside `PackageList(this).packages.apply { add(...) }`.
4. **Do not run `npx expo prebuild`** — it regenerates `android/` and wipes hand-written code
   (`SplashActivity`, `MainApplication` registration, `MedHaptics*`, themes/styles, manifest edits).
   If it is ever run, re-add `add(MedHapticsPackage())` to `MainApplication.kt` and re-check
   `AndroidManifest.xml` + `styles.xml`.

## Haptics (implemented natively — no `expo-haptics`)

| JS API — `src/lib/haptics.ts` | Native — `MedHapticsModule.kt` (Android SDK `Vibrator` / `VibrationEffect`) | Used by |
| --- | --- | --- |
| `tick()` | 18 ms one-shot, amplitude 150 | segmented pills (`SegmentedPill` — Medical/Dental, tabs), switch toggles |
| `alertPulse()` | waveform 55/75/55 ms @ 200/0/255 (buzz–pause–buzz warning) | delete/confirm dialog opens (`ConfirmDialog`) |
| `punch()` | 55 ms one-shot, amplitude 255 | confirming a danger ("Delete") dialog |

- Registration: `MedHapticsPackage.kt` → `add(MedHapticsPackage())` in `MainApplication.kt`.
- Permission: `android.permission.VIBRATE` already declared in `AndroidManifest.xml`.
- Fallback: if `NativeModules.MedHaptics` is missing, `src/lib/haptics.ts` falls back to
  React Native core `Vibration` (Android only), so nothing breaks if registration is lost.
- API floor: `VibrationEffect` on API 26+, legacy `Vibrator.vibrate()` below that.

## Building the APK

```bash
cd mobile\android
.\gradlew.bat assembleRelease --console=plain
# APK → mobile\android\app\build\outputs\apk\release\app-release.apk
```

Checks before declaring done: `npx tsc --noEmit` and `npx expo lint`
(the `expo` binary here is only the project's script runner — no Expo packages involved).
