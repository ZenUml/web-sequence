import { trackEvent } from './analytics';
import firebase from 'firebase/app';
import { log } from './utils';

const isExtension = typeof chrome !== 'undefined' && !!chrome?.runtime?.id;

function loginWithGoogleInExtension() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
      firebase.auth().signInWithCredential(credential).then(resolve).catch(reject);
    });
  });
}

export const auth = {
  logout() {
    if (isExtension) {
      chrome.identity.clearAllCachedAuthTokens(() => {});
    }
    firebase.auth().signOut();
  },
  login(providerName) {
    if (isExtension && providerName === 'google') {
      return loginWithGoogleInExtension()
        .then(() => {
          trackEvent('fn', 'loggedIn', providerName);
          window.db.local.set({ lastAuthProvider: providerName });
        })
        .catch(log);
    }

    var provider;
    if (providerName === 'facebook') {
      provider = new firebase.auth.FacebookAuthProvider();
    } else if (providerName === 'twitter') {
      provider = new firebase.auth.TwitterAuthProvider();
    } else if (providerName === 'google') {
      provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    } else {
      provider = new firebase.auth.GithubAuthProvider();
    }

    return firebase
      .auth()
      .signInWithPopup(provider)
      .then(function () {
        trackEvent('fn', 'loggedIn', providerName);
        window.db.local.set({ lastAuthProvider: providerName });
      })
      .catch(function (error) {
        log(error);
        if (error.code === 'auth/account-exists-with-different-credential') {
          alert(
            'You have already signed up with the same email using different social login',
          );
        }
      });
  },
};
