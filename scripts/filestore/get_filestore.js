const Firestore = require('@google-cloud/firestore');

//How to set up key file: https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments
const db = new Firestore({
  projectId: 'web-sequence-local', //project name: zenuml-app-prod
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

async function query() {
  const itemsRef = db.collection('items');
  const snapshot = await itemsRef.orderBy('updatedOn', 'desc').get();
  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }

  snapshot.forEach((doc) => {
    const r = convert(doc.data());
    console.log(
      `${r.id},${escapeForCsv(r.title)},${r.createdBy},${r.updatedOn},${escapeForCsv(r.code)}`,
    );
  });
}

function convert(doc) {
  return {
    id: doc.id,
    title: doc.title,
    code: doc.js,
    createdBy: doc.createdBy,
    updatedOn: new Date(doc.updatedOn).toISOString(),
  };
}

function escapeForCsv(input) {
  input = String(input);
  const escaped = input.replace(/"/g, '""');
  if (input.includes(',') || input.includes('\n')) {
    return `"${escaped}"`;
  }
  return input;
}

console.log('id,title,createdBy,updatedOn,code');
query();
