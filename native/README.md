# Switch It native pilot

Background seeker location during an **active parking handoff**.

Web/PWA seekers also POST the same Edge Function (`handoff-seeker-location`);
the native plugin adds **background GPS** while the WebView is not foreground.

## Why `webDir` is a placeholder

Next.js Server Actions cannot be exported as static Capacitor assets. The
native GPS + HTTP layer does not depend on the WebView staying alive after
`startHandoffTracking`. App Store packaging still needs a hosted Next origin
or a later hybrid packaging pass. Do **not** commit `server.url`.

## One-time setup

```bash
npm install
npx cap add ios
npx cap add android
npx cap sync
```

### iOS (Xcode)

1. `ios/App/App/Info.plist` already includes location usage strings + `UIBackgroundModes` → `location` after `cap add ios`. Re-merge `native/ios/Info.plist.additions.xml` if you regenerate the iOS project.
2. Signing & Capabilities → **Background Modes** → **Location updates** (confirm the capability checkbox matches Info.plist).
3. Apple Developer: enable location if required for your team. Add a privacy manifest (`PrivacyInfo.xcprivacy`) before App Store submission.
4. Plugin SPM: `native/handoff-background-location/Package.swift` is required for Capacitor 8.

### Android (Android Studio)

Plugin manifest already requests fine location + FGS location + notifications.
Confirm the merged app manifest includes:

- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_LOCATION`
- `ACCESS_FINE_LOCATION`
- `POST_NOTIFICATIONS` (API 33+)

Play Console: declare location foreground-service use (“navigation / active
handoff”) before production.

### Supabase

Apply live-location rate-limit migrations, then deploy the Edge Function:

```bash
npx supabase db push
supabase functions deploy handoff-seeker-location
```

Migrations include `20260823110000_claim_live_location_atomic_rate_limit.sql` and `20260823120000_claim_live_location_rate_limit_hardening.sql` (atomic GPS/status throttling).

`verify_jwt = true`. Service-role stays on the server. Function calls
`can_send_claim_location` with the seeker’s JWT, then service-role RPCs accept/reject updates before broadcasting.

### Device testing against hosted Next.js (dev only)

Do **not** commit `server.url`. Set `CAPACITOR_SERVER_URL` only in the shell
when syncing. If it is unset, Capacitor config has no remote server.

Sync iOS against production Vercel and open Xcode:

```bash
cd /Users/RotemKaplan/switch-it
CAPACITOR_SERVER_URL=https://switch-it-wine.vercel.app npx cap sync ios
npx cap open ios
```

`npx cap sync` without the env var must not write a remote `server.url`.
Generated `ios/App/App/capacitor.config.json` is gitignored.

## App icons

Source of truth: square mark cropped from `public/branding/switch-it-logo.png`
(same generator as `apple-touch-icon` / PWA icons).

```bash
npm run generate:app-icons
```

Writes:

- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024×1024)
- Android `mipmap-*/ic_launcher*.png` + cyan adaptive background color

Do not leave the default Capacitor placeholder icon in place.

Tracking starts only after an in-context handoff share (Open in Waze/Maps).
It stops on complete, cancel, claim/spot expiry, explicit Stop sharing,
logout, or active-claim change. A native expiry timer stops GPS even if the
WebView is gone.
