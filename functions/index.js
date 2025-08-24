const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const Mixpanel = require('mixpanel');

// Initialize with staging project when running in emulator
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  admin.initializeApp({
    projectId: 'staging-zenuml-27954',
  });
} else {
  admin.initializeApp(functions.config().firebase);
}
const db = admin.firestore();

//Mixpanel project: Confluence Analytics(new)
const mixpanel = Mixpanel.init('78617e65fdba543d752fb7f6483d55f4');

const webhook = require('./webhook');
const alertParser = require('./alert_parser');
const pubKey = functions.config().paddle?.pub_key;
const https = require('https');

exports.info = functions.https.onRequest((req, res) => {
  res.send(`Hello from ${process.env.GCLOUD_PROJECT}!`);
});

const verifyIdToken = (token) => admin.auth().verifyIdToken(token);

const supportedProductIds = (functions.config().paddle?.product_ids || '')
  .split(',')
  .filter(Boolean);
const checkSupportedProductIds = (productId) => {
  return productId && supportedProductIds.includes(productId);
};

exports.supported_product_ids = functions.https.onRequest(async (req, res) => {
  res.status(200).send(JSON.stringify(supportedProductIds));
});

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

exports.create_share = functions.https.onRequest(async (req, res) => {
  try {
    // Skip auth verification for local development if needed
    let decoded;
    if (process.env.FUNCTIONS_EMULATOR === 'true' && req.body.token === 'local-dev-token') {
      // Mock user for local testing
      decoded = { uid: 'local-test-user' };
    } else {
      decoded = await verifyIdToken(req.body.token);
    }
    const itemId = req.body.id;

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    // Get the item from Firestore
    const itemRef = db.collection('items').doc(itemId);
    const doc = await itemRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const itemData = doc.data();

    // Verify user owns this item
    if (itemData.createdBy !== decoded.uid) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Generate or reuse share token
    const crypto = require('crypto');
    const shareToken = itemData.shareToken || crypto.randomBytes(16).toString('hex');

    // Update item with sharing info
    await itemRef.update({
      isShared: true,
      shareToken: shareToken,
      sharedAt: FieldValue.serverTimestamp()
    });

    // Generate content hash for cache busting
    const contentHash = crypto.createHash('md5').update(itemData.js || '').digest('hex');

    // Return in the same format as the old API
    // Use origin from frontend request, with fallback to environment-specific defaults
    let baseUrl = req.body.origin;
    if (!baseUrl) {
      if (process.env.FUNCTIONS_EMULATOR === 'true') {
        // Local development fallback
        baseUrl = 'http://localhost:3000';
      } else if (process.env.GCLOUD_PROJECT === 'staging-zenuml-27954') {
        // Staging environment fallback
        baseUrl = 'https://staging.zenuml.com';
      } else {
        // Production environment fallback
        baseUrl = 'https://app.zenuml.com';
      }
    }

    res.json({
      page_share: `${baseUrl}?id=${itemId}&share-token=${shareToken}`,
      md5: contentHash
    });

  } catch (error) {
    console.error('Error creating share:', error);
    res.status(500).json({ error: 'Failed to create share' });
  }
});

exports.get_shared_item = functions.https.onRequest(async (req, res) => {
  try {
    console.log('=== DEBUG: get_shared_item ===');
    console.log('Full request URL:', req.url);
    console.log('Query object:', req.query);
    console.log('All query keys:', Object.keys(req.query));

    const itemId = req.query.id;
    const shareToken = req.query.token || req.query['share-token'];

    console.log('Parsed params:', { itemId, shareToken });
    console.log('ItemId type:', typeof itemId, 'ShareToken type:', typeof shareToken);

    if (!itemId || !shareToken) {
      console.log('Missing required params - itemId exists:', !!itemId, 'shareToken exists:', !!shareToken);
      return res.status(400).json({ error: 'Item ID and share token are required' });
    }

    // Get the item from Firestore using Admin SDK (bypasses security rules)
    const itemRef = db.collection('items').doc(itemId);
    const doc = await itemRef.get();

    if (!doc.exists) {
      console.log('DEBUG: Item not found in Firestore');
      return res.status(404).json({ error: 'Item not found' });
    }

    const itemData = doc.data();
    console.log('DEBUG: Item data loaded:', {
      id: itemData.id,
      title: itemData.title,
      isShared: itemData.isShared,
      hasShareToken: !!itemData.shareToken,
      shareTokenMatch: itemData.shareToken === shareToken,
      createdBy: itemData.createdBy,
      actualToken: itemData.shareToken,
      requestedToken: shareToken
    });

    // Verify item is shared and token matches
    if (!itemData.isShared || itemData.shareToken !== shareToken) {
      console.log('DEBUG: Token validation failed');
      return res.status(403).json({ error: 'Invalid share token or item not shared' });
    }

    console.log('DEBUG: Token validation passed, returning item');
    // Return item data with read-only flag
    res.json({
      ...itemData,
      isReadOnly: true
    });

  } catch (error) {
    console.error('Error getting shared item:', error);
    res.status(500).json({ error: 'Failed to get shared item' });
  }
});

exports.track = functions.https.onRequest(async (req, res) => {
  if (!req.body.event) {
    console.log('missing req.body.event');
    res.status(400).send('invalid request');
    return;
  }

  // Extract event name and userId, pass through all other properties
  const { event, userId, ...eventProperties } = req.body;
  
  console.log('Track request received:', {
    event,
    userId,
    eventProperties
  });
  
  const mixpanelData = {
    distinct_id: userId,
    displayProductName: 'FireWeb',
    ...eventProperties, // Pass through all additional properties from frontend
  };
  
  console.log('Sending to Mixpanel:', { event, properties: mixpanelData });
  
  mixpanel.track(event, mixpanelData);

  // Send a success response to prevent 502 Bad Gateway error
  res.status(200).send('Event tracked successfully');
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
