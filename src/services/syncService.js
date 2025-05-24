import firebase from 'firebase/app';

const larasiteBaseUrl = 'https://sequence-diagram.zenuml.com';
const publicBaseUrl = 'https://zenuml.com/sequence-diagram';

async function syncDiagram(currentItem) {
  // if (location.host === 'localhost:8080') {
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

  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    console.error('No user is logged in');
    return;
  }

  const token = await currentUser.getIdToken(true);
  const user = {
    name: currentUser.displayName,
    id: currentUser.uid,
    email: currentUser.email,
    email_verified: currentUser.emailVerified,
    picture: currentUser.photoURL,
  };

  const data = {
    token,
    user,
    firebase_diagram_id: id,
    name: title,
    content: js,
    description: 'Shared diagram from https://app.zenuml.com',
  };
  console.log('calling LaraSite with data:', data);
  try {
    const response = await fetch(`${larasiteBaseUrl}/diagrams`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();

    result.page_share = result.page_share.replace(larasiteBaseUrl.replace('https://', 'http://'), publicBaseUrl);
    console.log('save to LaraSite result: ', result);
    return result;
  } catch (error) {
    console.warn('Error when calling LaraSite', error);
    throw Error('Error when calling LaraSite');
  }
}

function getShareLink(syncResult) {
  return `${syncResult.page_share}?v=${syncResult.md5}`;
}

export { syncDiagram, getShareLink };
