const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Mixpanel = require('mixpanel');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

//Mixpanel project: Confluence Analytics(new)
const mixpanel = Mixpanel.init('0c62cea9ed2247f4824bf196f6817941');

const webhook = require('./webhook');
const alertParser = require('./alert_parser');
const pubKey = functions.config().paddle.pub_key;
const https = require('https');

exports.info = functions.https.onRequest((req, res) => {
  res.send(`Hello from ${process.env.GCLOUD_PROJECT}!`);
});

const verifyIdToken = (token) => admin.auth().verifyIdToken(token);

exports.authenticate = functions.https.onRequest(async (req, res) => {
  console.log('request:', req);
  const auth = req.get('Authorization');
  const decoded = await verifyIdToken(auth);
  console.log('decoded token:', decoded);
  res.send(decoded.uid);
});

exports.sync_diagram = functions.https.onRequest(async (req, res) => {
  const decoded = await verifyIdToken(req.body.token);
  console.log('decoded token:', decoded);
  const user = {
    name: decoded.name,
    id: decoded.user_id,
    email: decoded.email,
    email_verified: decoded.email_verified,
    picture: decoded.picture,
  };

  const hostname =
    functions.config().larasite.host || 'sequence-diagram.zenuml.com';
  const baseUrlHttps = `https://${hostname}`;
  const baseUrlHttp = `http://${hostname}`;
  const publicBaseUrl =
    functions.config().larasite.public_base_url ||
    'https://zenuml.com/sequence-diagram';
  console.log('using LaraSite URL:', baseUrlHttps);
  console.log('using publicBaseUrl:', publicBaseUrl);

  const supportedProductIds = (functions.config().paddle.product_ids || '')
    .split(',')
    .filter(Boolean);
  const checkSupportedProductIds = (productId) =>
    Boolean(productId && supportedProductIds.includes(productId));

  exports.supportedProductIds = functions.https.onRequest(async (req, res) => {
    res.status(200).send(JSON.stringify(supportedProductIds));
  });

  const replaceBaseUrlInShareLink = (responseData) => {
    const data = JSON.parse(responseData);
    data.page_share = data.page_share
      .replace(baseUrlHttp, publicBaseUrl)
      .replace(baseUrlHttps, publicBaseUrl);
    return JSON.stringify(data);
  };

  const options = {
    hostname,
    port: 443,
    path: '/diagrams',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  const data = JSON.stringify({
    token: req.body.token,
    user,
    firebase_diagram_id: req.body.id,
    name: req.body.name,
    content: req.body.content,
    description: req.body.description,
    imageBase64: req.body.imageBase64,
  });
  console.log('request - options: ', options, 'data: ', data);

  const request = https.request(options, (response) => {
    console.log(
      `response - code: ${response.statusCode}, headers: `,
      response.headers,
    );

    let responseData = '';
    response.on('data', (chunk) => {
      responseData += chunk;
    });

    response.on('end', () => {
      res.send(replaceBaseUrlInShareLink(responseData));
    });
  });

  request.on('error', (error) => {
    console.error('request failed: ', error);
    res.send(error);
  });

  request.write(data);
  request.end();
});

exports.track = functions.https.onRequest(async (req, res) => {
  if (!req.body.event) {
    console.log('missing req.body.event');
    res.status(400).send('invalid request');
    return;
  }

  mixpanel.track(req.body.event, {
    distinct_id: req.body.userId,
    event_category: req.body.category,
    event_label: req.body.label,
    displayProductName: 'FireWeb',
  });
});

exports.webhook = functions.https.onRequest(async (req, res) => {
  if (req.body && req.body.p_signature) {
    const valid = webhook.validate(req.body, pubKey);
    if (valid) {
      if (alertParser.supports(req)) {
        const subscription = alertParser.parse(req);
        if (!checkSupportedProductIds(subscription.subscription_plan_id)) {
          res.send(
            `subscription_plan_id:${subscription.subscription_plan_id} not supported`,
          );
          return;
        }
        const userId = getUserIdFromPassthrough(subscription.passthrough);
        const user = await db.collection('users').doc(userId).get();
        if (user.exists) {
          await db
            .collection('user_subscriptions')
            .doc('user-' + userId)
            .set(subscription);
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

function getUserIdFromPassthrough(passthrough) {
  return isJSONString(passthrough)
    ? JSON.parse(passthrough).userId
    : passthrough;
}

function isJSONString(str) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}
