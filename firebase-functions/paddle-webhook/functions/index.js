const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const webhook = require('./webhook');
const alertParser = require('./alert_parser');
const pubKey = functions.config().paddle.pub_key;
const http = require('http');

exports.info = functions.https.onRequest((req, res) => {
    res.send(`Hello from ${process.env.GCLOUD_PROJECT}!`);
});

const verifyIdToken = (token) => admin.auth().verifyIdToken(token);

exports.authenticate = functions.https.onRequest(async (req, res) => {
    console.log('request:', req)
    const auth = req.get('Authorization');
    const decoded = await verifyIdToken(auth);
    console.log('decoded token:', decoded);
    res.send(decoded.uid);
});

exports.sync_diagram = functions.https.onRequest(async (req, res) => {
    const decoded = await verifyIdToken(req.body.token);
    console.log('decoded token:', decoded);
    const user = {name: decoded.name, id: decoded.user_id, email: decoded.email, email_verified: decoded.email_verified, picture: decoded.picture};

    const options = {
        hostname: '18.139.29.58',
        port: 8000,
        path: '/diagrams',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    const data = JSON.stringify({token: req.body.token, user, firebase_diagram_id: req.body.id, name: req.body.name, content: req.body.content, description: req.body.description,imageBase64: req.body.imageBase64});
    console.log('http request with:', options, data);

    const request = http.request(options, (response) => {
        let responseData = '';
        response.on('data', (chunk) => {
            responseData += chunk;
        });

        response.on('end', () => {
            res.send(responseData);
        });
    });

    request.on('error', (error) => {
        console.error(error);
        res.send(error);
    });

    request.write(data);
    request.end();
});

exports.webhook = functions.https.onRequest(async (req, res) => {
    if (req.body && req.body.p_signature) {
        const valid = webhook.validate(req.body, pubKey);
        if (valid) {
            if (alertParser.supports(req)) {
                const subscription = alertParser.parse(req);
                const userId = subscription.passthrough;

                const user = await db.collection('users').doc(userId).get();
                if (user.exists) {
                    await db.collection('user_subscriptions').doc('user-' + userId).set(subscription);
                    res.send('Accepted');
                } else {
                    res.send('Invalid userId: ' + userId);
                }
            } else {
                console.warn(`unsupported alert ${req.body.alert_name}`);
                res.send(`unsupported alert ${req.body.alert_name}`);
            }
        } else {
            res.send('Invalid signature');
        }
    } else {
        res.send('Invaid request');
    }
});
