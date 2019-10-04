const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const webhook = require('./webhook');
const alertParser = require('./alert_parser');
const pubKey = functions.config().paddle.pub_key;

exports.info = functions.https.onRequest((req, res) => {
    res.send(`Hello from ${process.env.GCLOUD_PROJECT}!`);
});

exports.webhook = functions.https.onRequest(async (req, res) => {
    if(req.body && req.body.p_signature) {
        const valid = webhook.validate(req.body, pubKey);
        if(valid) {
            if(alertParser.supports(req)) {
                const subscription = alertParser.parse(req);
                const userId = subscription.passthrough;

                const user = await db.collection('users').doc(userId).get();
                if(user.exists) {
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
