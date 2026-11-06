import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import config from './services/configuration';

firebase.initializeApp(config.firebase);

// Test seam for e2e/legacy. Vite replaces the env value at build time, so this
// block is removed from production bundles.
if (import.meta.env.VITE_USE_EMULATOR === '1') {
  firebase.auth().useEmulator('http://127.0.0.1:9199');
  firebase.firestore().settings({ host: '127.0.0.1:8180', ssl: false });
  window.__e2eFirebase = firebase;
  // Registered before the app's listener, so a spec can act ahead of the app.
  firebase.auth().onAuthStateChanged((user) => {
    if (window.__e2eOnAuth) window.__e2eOnAuth(user);
  });
}
