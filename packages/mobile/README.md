# Mile Quest mobile

React Native prototype for the team walking app. It signs in to the Next.js API, shows the dashboard, logs a walk by hand, lists activities, and imports walking distance from Apple Health or Health Connect.

The API address defaults to `https://mile-quest.vercel.app`. Change it on the sign-in screen if you are pointed at another deployment. Tokens are stored with `expo-secure-store`.

Health sync does not run in Expo Go. Apple Health and Health Connect need a development build so their config plugins are compiled into the app. This package uses Expo SDK 55, which builds with the React Native new architecture. That is required by the HealthKit library.

## Install

From the repository root, with Node 22:

```bash
npm install
```

That installs this workspace and builds `@mile-quest/shared`.

## Try the JavaScript without a device

These commands typecheck, lint, and run the sync tests. They do not open a simulator.

```bash
npm run type-check --workspace=@mile-quest/mobile
npm run lint --workspace=@mile-quest/mobile
npm test --workspace=@mile-quest/mobile
```

## Run on the iOS Simulator

You need Xcode. A paid Apple Developer account is not required for the simulator.

```bash
cd packages/mobile
npx expo run:ios
```

The first run compiles a development build and starts Metro. Later runs can use `npx expo start --dev-client`.

The simulator’s Health app starts empty, so Sync walks will usually report that there is no walking distance. You can add sample workouts in the Health app on the simulator, but a phone that already has steps is the real test. Sign-in, the dashboard, manual logging, and the activity list work without any Health data.

## Run on an Android emulator or phone

You need Android Studio (or a phone with USB debugging). A Google Play Console account is not required to sideload a debug build.

```bash
cd packages/mobile
npx expo run:android
```

Health Connect is included on Android 14 and later. On Android 13 and earlier, install the Health Connect app. The first sync opens Health Connect’s permission screen. A debug build installed this way can read distance and exercise data without a Play Store listing.

## Install on Douglas’s iPhone

HealthKit is included in this prototype, and Apple only allows that entitlement for the paid Apple Developer Program ($99 a year). A free Apple ID can install apps that do not use HealthKit, but it cannot sign this build.

Once the Apple Developer account is available:

1. Open Xcode at least once and sign in with that team.
2. From `packages/mobile`, run `npx expo run:ios --device` and pick the phone. The phone must be unlocked and trusted.
3. On the phone, allow the developer certificate under Settings → General → VPN & Device Management if iOS asks.
4. Sign in, open Health, turn on import, and tap Sync walks. Accept the Apple Health prompt.

The other path is EAS. Create a free Expo account, then from `packages/mobile`:

```bash
npx eas-cli login
npx eas-cli build --profile development-device --platform ios
```

EAS will ask for the Apple team the first time. `development` (without `-device`) builds a simulator app and does not need Apple credentials. `eas.json` does not submit anything to the App Store.

Until the Apple Developer account exists, use the iOS Simulator for everything except a live HealthKit read.

## Install on an Android phone

No Play Console account is required for a debug or internal APK.

Local USB install:

```bash
cd packages/mobile
npx expo run:android --device
```

Or build an APK in the cloud with a free Expo account:

```bash
cd packages/mobile
npx eas-cli login
npx eas-cli build --profile development-device --platform android
```

Download the APK from the EAS build page and install it. Android will ask you to allow installs from the browser. Then open Health Connect (install it from the Play Store first on Android 13 and earlier), grant distance and exercise access, and sync.

## Accounts you need later, not for this prototype

| When | Account |
| --- | --- |
| iOS Simulator, manual walks, dashboard | None beyond a Mile Quest login |
| Android debug install and Health Connect | None. A free Expo account only if you use EAS |
| Install the HealthKit build on a real iPhone, TestFlight, or the App Store | Apple Developer Program |
| Publish on Google Play, or let a non-debug release build read Health Connect in production | Google Play Console. Declare the Health Connect data types there. Approval is separate from this prototype and can take several days |

`eas.json` has development and internal preview profiles only. It does not configure store submission.

## What a sync imports

The app reads the last 14 days.

- iOS: walking, running, hiking, and wheelchair workouts, plus walking/running distance samples.
- Android: the same kinds of exercise sessions from Health Connect, plus distance records. A session with no distance of its own picks up the distance records that fall inside it.

Each sample is sent to `POST /api/activities` with `source` `APPLE_HEALTH` or `HEALTH_CONNECT` and an `externalId`. The API returns the original activity when that pair was already stored for the signed-in user, so a second sync does not double-count the walk. Another person can still import a sample that happens to share an id.
