# مُعين — Firebase Phase 2

Project: `world-cup-2026-d3091`
Region: `europe-west1`

## Added
- Mueen client namespace: `/mueen/users/{uid}`
- Firebase Authentication support in the PWA.
- Realtime Database sync adapter.
- FCM token registration.
- Cloud Function export: `mueenPushDispatch`.
- Isolated security-rule snippet in `mueen.database.rules.snippet.json`.

## Important deployment safety
The Firebase project is shared with other apps. Do not replace the full Realtime Database rules with the snippet file. Merge the `mueen` node into the existing published rules.

The Cloud Function can be deployed from this repository with Firebase CLI using the existing `.firebaserc` project mapping.
