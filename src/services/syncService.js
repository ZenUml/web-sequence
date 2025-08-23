import firebase from 'firebase/app';

async function syncDiagram(currentItem) {
  // Remove skip for local development to test Firebase emulator
  // if (location.host === 'localhost:3000') {
  //   console.log('Skipping sync-diagram call in local environment');
  //   return;
  // }

  const { id, title, js } = currentItem;
  if (!js || !title) {
    console.error(
      `Cannot sync diagram because of missing ${!js ? '"js"' : '"title"'} data`,
      currentItem,
    );
    return;
  }

  // Check if user is authenticated before attempting to get token
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    console.warn('User is not authenticated. Cannot sync diagram.');
    throw new Error('User authentication required to sync diagram');
  }

  const token = await currentUser.getIdToken(true);

  const data = {
    token,
    id,
    name: title,
    content: js,
    description: 'Shared diagram from https://app.zenuml.com',
    origin: window.location.origin, // Pass the frontend origin
  };
  console.log('calling /create-share with data:', data);
  try {
    const response = await fetch('/create-share', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();
    console.log('Firebase share result: ', result);
    return result;
  } catch (error) {
    console.warn('Error when calling /create-share', error);
    throw Error('Error when calling /create-share');
  }
}

function getShareLink(syncResult) {
  // Check if URL already has query parameters
  const separator = syncResult.page_share.includes('?') ? '&' : '?';
  return `${syncResult.page_share}${separator}v=${syncResult.md5}`;
}

export { syncDiagram, getShareLink };
