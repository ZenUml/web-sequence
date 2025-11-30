import { deferred } from '../deferred';
import { log, generateRandomId } from '../utils';
import firebase from 'firebase/app';
import 'firebase/firestore';

export const folderService = {
  async getUserRef() {
    const remoteDb = await window.db.getDb();
    return remoteDb.collection('users').doc(window.user.uid);
  },

  async createFolder(name) {
    const d = deferred();
    if (!window.user) {
      d.reject('User not logged in');
      return d.promise;
    }

    const folderId = 'folder-' + generateRandomId();
    const folder = {
      id: folderId,
      name,
      createdOn: Date.now(),
      updatedOn: Date.now()
    };

    try {
      const userRef = await this.getUserRef();
      // Use arrayUnion to append the new folder to the 'folders' array
      // This works even if 'folders' field doesn't exist yet (it creates it)
      // But we need to ensure the document exists. itemService ensures user doc exists.
      // We'll use set with merge just to be safe if we can't guarantee doc existence,
      // but arrayUnion requires update() or set() with specific syntax.
      // update() fails if doc missing. set({folders: ...}, {merge:true}) overwrites if not arrayUnion?
      // arrayUnion works with set since Firebase 7.x?
      // Let's assume doc exists because app creates it on login/item fetch.
      
      // Safer to check doc existence or use set with merge for initial creation
      // But arrayUnion is best used with update.
      
      const doc = await userRef.get();
      if (!doc.exists) {
         await userRef.set({ folders: [folder] }, { merge: true });
      } else {
         await userRef.update({
           folders: firebase.firestore.FieldValue.arrayUnion(folder)
         });
      }

      d.resolve(folder);
    } catch (error) {
      log('Error creating folder:', error);
      d.reject(error);
    }
      
    return d.promise;
  },

  async getFolders() {
    const d = deferred();
    if (!window.user) {
      d.resolve([]);
      return d.promise;
    }

    try {
      const userRef = await this.getUserRef();
      const doc = await userRef.get();
      
      if (doc.exists && doc.data().folders) {
        d.resolve(doc.data().folders);
      } else {
        d.resolve([]);
      }
    } catch (error) {
      log('Error fetching folders:', error);
      // If users permission is somehow missing, we propagate error
      d.reject(error);
    }
      
    return d.promise;
  },

  async renameFolder(folderId, newName) {
    const d = deferred();
    if (!window.user) {
      d.reject('User not logged in');
      return d.promise;
    }

    try {
      const userRef = await this.getUserRef();
      // We need to read, modify, write because we can't update an item in array by ID
      
      await window.db.getDb().then(db => db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        if (!doc.exists) throw 'User doc not found';
        
        const folders = doc.data().folders || [];
        const index = folders.findIndex(f => f.id === folderId);
        if (index !== -1) {
          // Create a new array to avoid mutation issues if any
          const newFolders = [...folders];
          newFolders[index] = { ...newFolders[index], name: newName, updatedOn: Date.now() };
          t.update(userRef, { folders: newFolders });
        }
      }));

      d.resolve();
    } catch (error) {
      log('Error renaming folder:', error);
      d.reject(error);
    }

    return d.promise;
  },

  async deleteFolder(folderId) {
    const d = deferred();
    if (!window.user) {
      d.reject('User not logged in');
      return d.promise;
    }

    try {
      const userRef = await this.getUserRef();
      
      await window.db.getDb().then(db => db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        if (!doc.exists) return;
        
        const folders = doc.data().folders || [];
        const newFolders = folders.filter(f => f.id !== folderId);
        
        if (folders.length !== newFolders.length) {
           t.update(userRef, { folders: newFolders });
        }
      }));
      
      d.resolve();
    } catch (error) {
      log('Error deleting folder:', error);
      d.reject(error);
    }

    return d.promise;
  }
};
