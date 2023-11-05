import firebase from 'firebase/app';

async function syncDiagram(currentItem) {
  const token = await firebase.auth().currentUser.getIdToken(true);

  const data = { token, id: currentItem.id, name: currentItem.title, content: currentItem.js, description: JSON.stringify({ source: 'app.zenuml.com' }), imageBase64: currentItem.imageBase64 };
  console.log('calling /sync-diagram with data:', data)

  const result = await (await fetch('/sync-diagram', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })).json()
  console.log('save to php app result: ', result)

  return result;
}

function getShareLink(syncResult) {
  return `${syncResult.page_share}?v=${syncResult.md5}`;
}

export { syncDiagram, getShareLink };