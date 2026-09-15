// Public Firebase Web Push configuration.
// These values are public client identifiers, not server secrets.
// push.js also checks /pushPublicConfig in Realtime Database so the public
// identifiers can be completed without another website release.
window.UCL_PUSH_CONFIG = {
  databaseURL: 'https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'world-cup-2026-d3091',
  authDomain: 'world-cup-2026-d3091.firebaseapp.com',
  apiKey: '',
  messagingSenderId: '',
  appId: '',
  vapidKey: '',
  publicConfigPath: 'pushPublicConfig'
};
