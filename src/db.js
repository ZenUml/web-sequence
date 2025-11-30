import './firebaseInit';
import firebase from 'firebase/app';
import 'firebase/firestore';
import { deferred } from './deferred';
import { trackEvent } from './analytics';
import { log } from './utils';

(() => {
  const FAUX_DELAY = 1;

  var db;
  var dbPromise;

  var local = {
    get: (obj, cb) => {
      const retVal = {};
      if (typeof obj === 'string') {
        try {
          retVal[obj] = JSON.parse(window.localStorage.getItem(obj));
        } catch (e) {
          // Handle non-JSON values (legacy data stored as plain strings)
          retVal[obj] = window.localStorage.getItem(obj);
        }
        setTimeout(() => cb(retVal), FAUX_DELAY);
      } else {
        Object.keys(obj).forEach((key) => {
          const val = window.localStorage.getItem(key);
          if (val === undefined || val === null) {
            retVal[key] = obj[key];
          } else {
            try {
              retVal[key] = JSON.parse(val);
            } catch (e) {
              // Handle non-JSON values (legacy data stored as plain strings)
              retVal[key] = val;
            }
          }
        });
        setTimeout(() => cb(retVal), FAUX_DELAY);
      }
    },
    set: (obj, cb) => {
      Object.keys(obj).forEach((key) => {
        window.localStorage.setItem(key, JSON.stringify(obj[key]));
      });
      /* eslint-disable consistent-return */
      setTimeout(() => {
        if (cb) {
          return cb();
        }
      }, FAUX_DELAY);
      /* eslint-enable consistent-return */
    },
    remove: (key, cb) => {
      window.localStorage.removeItem(key);
      setTimeout(() => cb(), FAUX_DELAY);
    },
  };
  const dbLocalAlias = chrome && chrome.storage ? chrome.storage.local : local;
  const dbSyncAlias = chrome && chrome.storage ? chrome.storage.sync : local;

  async function getDb() {
    if (dbPromise) {
      return dbPromise;
    }
    log('Initializing firestore');
    dbPromise = new Promise((resolve, reject) => {
      if (db) {
        return resolve(db);
      }
      // Initialize Cloud Firestore through firebase
      db = firebase.firestore();
      
      // Try to enable persistence, but don't fail if it's already been called
      db.enablePersistence({ synchronizeTabs: true })
        .then(function () {
          log('firebase db ready with persistence', db);
          resolve(db);
        })
        .catch(function (err) {
          if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled
            // in one tab at a a time.
            // Also used for SDK version mismatch errors
            if (err.message && err.message.indexOf('newer version') !== -1) {
              log('Persistence disabled due to SDK version mismatch', err);
              resolve(db);
              return;
            }
            
            alert(
              "Opening ZenUML web app in multiple tabs isn't supported at present and it seems like you already have it opened in another tab. Please use in one tab.",
            );
            trackEvent('fn', 'multiTabError');
            // Fallback to persistence disabled instead of rejecting, so the app can continue
            log('Persistence disabled due to multiple tabs', err);
            resolve(db);
          } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the
            // features required to enable persistence
            log('Persistence not supported, continuing without it');
            resolve(db);
          } else {
            // If persistence was already enabled (e.g., by another call),
            // just continue without it
            log('Could not enable persistence, continuing without it:', err.message);
            resolve(db);
          }
        });
    });
    return dbPromise;
  }

  async function getUserLastSeenVersion() {
    const d = deferred();
    // Will be chrome.storage.sync in extension environment,
    // otherwise will fallback to localstorage
    dbSyncAlias.get(
      {
        lastSeenVersion: '',
      },
      (result) => {
        d.resolve(result.lastSeenVersion);
      },
    );
    return d.promise;
    // Might consider getting actual value from remote db.
    // Not critical right now.
  }

  async function setUserLastSeenVersion(version) {
    // Setting the `lastSeenVersion` in localStorage(sync for extension) always
    // because next time we need to fetch it irrespective of the user being
    // logged in or out quickly from local storage.
    dbSyncAlias.set(
      {
        lastSeenVersion: version,
      },
      function () {},
    );
    if (window.user) {
      const remoteDb = await getDb();
      remoteDb.doc(`users/${window.user.uid}`).update({
        lastSeenVersion: version,
      });
    }
  }

  async function getUser(userId) {
    const remoteDb = await getDb();
    return remoteDb
      .doc(`users/${userId}`)
      .get()
      .then((doc) => {
        if (!doc.exists)
          return remoteDb.doc(`users/${userId}`).set(
            {},
            {
              merge: true,
            },
          );
        const user = doc.data();
        Object.assign(window.user, user);
        return user;
      });
  }

  // Fetch user settings.
  // This isn't hitting the remote db because remote settings
  // get fetch asynchronously (in user/) and update the environment.
  function getSettings(defaultSettings) {
    const d = deferred();
    // Will be chrome.storage.sync in extension environment,
    // otherwise will fallback to localstorage
    dbSyncAlias.get(defaultSettings, (result) => {
      d.resolve(result);
    });
    return d.promise;
  }

  window.db = {
    getDb,
    getUser,
    getUserLastSeenVersion,
    setUserLastSeenVersion,
    getSettings,
    local: dbLocalAlias,
    sync: dbSyncAlias,
  };
})();
