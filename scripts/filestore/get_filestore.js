const Firestore = require('@google-cloud/firestore');

//How to set up key file: https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments
const db = new Firestore({
  projectId: 'staging-zenuml-27954', //project name: web-sequence-local(zenuml-app-prod)
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const mysql = require('mysql');

const dbConfig = {
  host: 'localhost',
  user: 'zenuml',
  password: process.env.MYSQL_PASSWORD,
  database: 'zenuml',
};

const connection = mysql.createConnection(dbConfig);

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

function queryMysql(sql, data) {
  return new Promise((resolv, reject) => {
    connection.query(sql, data, (err, results, fields) => {
      if (err) {
        console.log('err:', err, 'results:', results, 'fields:', fields)
        reject('Error executing query:', err);
        return;
      }
      resolv(results);
    });
  })
}

function convert(doc) {
  //doc.createdBy
  return { firebase_diagram_id: doc.id, name: doc.title, content: doc.js, author_id: '1', public: 0, updated_at: new Date(doc.updatedOn), description: 'Migrated diagram from https://app.zenuml.com' }
}

async function syncToMysql(doc) {
  const r = convert(doc.data());

  const mr = await queryMysql(`select * from diagrams where firebase_diagram_id = '${r.firebase_diagram_id}'`);
  if (!mr.length) {
    console.log('not found: ', r.firebase_diagram_id)
    console.log('insert result:', await queryMysql(`insert into diagrams SET ?`, r))
  }
  console.log(`found ${r.firebase_diagram_id} in mysql, skipping`);
}

async function queryFirebase() {
  const itemsRef = db.collection('items');
  const snapshot = await itemsRef.orderBy('updatedOn', 'asc').get(); //.limit(1)
  if (snapshot.empty) {
    console.log('No matching documents.');
    return;
  }

  return await Promise.all(snapshot.docs.map(syncToMysql));
}

queryFirebase().then(r => {
  console.log('closing connection');
  connection.end();
});