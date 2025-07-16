const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Mixpanel = require('mixpanel');

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

//Mixpanel project: Confluence Analytics(new)
const mixpanel = Mixpanel.init('0c62cea9ed2247f4824bf196f6817941');

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

// AI Title Generation Function
exports.generateTitle = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // Verify authentication
    const auth = req.get('Authorization');
    if (!auth) {
      res.status(401).send('Unauthorized');
      return;
    }

    const decoded = await verifyIdToken(auth);
    const userId = decoded.uid;

    // Get diagram content from request
    const { content } = req.body;
    if (!content) {
      res.status(400).send('Missing diagram content');
      return;
    }

    // Generate title using AI
    const title = await generateTitleFromContent(content, userId);
    
    // Track usage
    mixpanel.track('ai_title_generated', {
      distinct_id: userId,
      event_category: 'ai',
      displayProductName: 'FireWeb',
    });

    res.status(200).json({ title });
  } catch (error) {
    console.error('AI title generation error:', error);
    res.status(500).json({ error: 'Failed to generate title' });
  }
});

async function generateTitleFromContent(content, userId) {
  // Analyze ZenUML content
  const analysis = analyzeZenUMLContent(content);
  
  // Check cache first
  const cacheKey = generateCacheKey(content);
  const cachedTitle = await getCachedTitle(cacheKey);
  if (cachedTitle) {
    return cachedTitle;
  }

  // Check rate limiting
  const rateLimitKey = `rate_limit_${userId}`;
  const rateLimitAllowed = await checkRateLimit(rateLimitKey);
  if (!rateLimitAllowed) {
    throw new Error('Rate limit exceeded');
  }

  try {
    // Call OpenAI API
    const openaiApiKey = functions.config().openai?.api_key;
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const title = await callOpenAI(analysis, content, openaiApiKey);
    
    // Cache the result
    await setCachedTitle(cacheKey, title);
    
    return title;
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Return fallback title
    return generateFallbackTitle(analysis);
  }
}

function analyzeZenUMLContent(code) {
  if (!code || typeof code !== 'string') {
    return { participants: [], methods: [], keywords: [], domain: '' };
  }

  const lines = code.split('\n').map(line => line.trim());
  const participants = new Set();
  const methods = new Set();
  const keywords = new Set();
  const comments = [];

  lines.forEach(line => {
    if (line.startsWith('//')) {
      comments.push(line.substring(2).trim());
      return;
    }

    if (!line || line.startsWith('/*') || line.startsWith('*')) return;

    const methodCall = line.match(/(\w+)\.(\w+)\s*\(/);
    if (methodCall) {
      participants.add(methodCall[1]);
      methods.add(methodCall[2]);
    }

    const participant = line.match(/^(\w+)\s*$/);
    if (participant) {
      participants.add(participant[1]);
    }

    const businessTerms = line.match(/\b(get|create|update|delete|process|handle|manage|validate|authenticate|authorize|login|logout|register|book|user|library|order|payment|account|customer|product|service|api|database|auth|admin|dashboard|report|search|filter|export|import|notification|email|message|chat|upload|download|sync|backup|restore|config|setting|profile|cart|checkout|invoice|receipt|transaction|transfer|withdraw|deposit|balance|history|analytics|metric|log|error|warning|info|debug|trace|monitor|alert|health|status|version|release|deploy|build|test|dev|prod|staging|local|remote|cloud|server|client|web|mobile|desktop|app|system|platform|framework|library|tool|util|helper|service|component|module|plugin|extension|widget|control|element|item|entity|model|view|controller|route|middleware|filter|guard|interceptor|decorator|factory|builder|manager|handler|processor|validator|parser|formatter|serializer|deserializer|encoder|decoder|compressor|decompressor|optimizer|analyzer|generator|converter|transformer|mapper|adapter|wrapper|proxy|cache|store|repository|dao|dto|vo|bo|po|entity|aggregate|event|command|query|request|response|result|error|exception|success|failure|pending|loading|complete|cancel|timeout|retry|fallback|default|custom|standard|advanced|basic|simple|complex|manual|automatic|sync|async|batch|single|multi|global|local|public|private|internal|external|static|dynamic|virtual|abstract|concrete|interface|implementation|specification|definition|declaration|configuration|initialization|finalization|cleanup|setup|teardown|start|stop|pause|resume|reset|refresh|reload|update|upgrade|downgrade|migrate|rollback|commit|rollback|save|load|read|write|execute|run|invoke|call|send|receive|publish|subscribe|listen|watch|observe|trigger|emit|dispatch|broadcast|notify|alert|warn|info|debug|trace|log|audit|track|monitor|measure|count|sum|average|min|max|sort|filter|search|find|select|insert|update|delete|create|destroy|build|compile|parse|render|format|validate|verify|check|test|assert|expect|mock|stub|spy|fake|dummy|placeholder|template|example|sample|demo|prototype|proof|concept|idea|plan|design|architecture|pattern|best|practice|convention|standard|guideline|rule|policy|procedure|workflow|process|step|phase|stage|cycle|iteration|loop|condition|branch|merge|split|join|fork|clone|copy|move|rename|replace|swap|exchange|convert|transform|map|reduce|filter|fold|zip|unzip|pack|unpack|serialize|deserialize|encode|decode|encrypt|decrypt|hash|salt|token|key|secret|password|username|email|phone|address|name|title|description|comment|note|tag|label|category|type|kind|class|group|set|list|array|map|dict|hash|tree|graph|node|edge|link|path|route|url|uri|endpoint|resource|entity|object|value|property|attribute|field|column|row|record|document|file|folder|directory|project|workspace|environment|context|scope|namespace|package|module|library|framework|tool|utility|service|component|widget|control|element|item|entity|model|view|controller|presenter|viewmodel|adapter|wrapper|proxy|facade|decorator|observer|listener|handler|callback|promise|future|task|job|worker|thread|process|queue|stack|heap|memory|storage|database|cache|session|cookie|token|authorization|authentication|permission|role|user|admin|guest|anonymous|public|private|protected|internal|external|readonly|writeonly|readwrite|immutable|mutable|const|var|let|final|static|abstract|virtual|override|implement|extend|inherit|compose|mixin|trait|interface|class|struct|enum|union|tuple|record|generic|template|macro|annotation|attribute|metadata|reflection|introspection|serialization|deserialization|marshalling|unmarshalling|encoding|decoding|compression|decompression|optimization|performance|scalability|reliability|availability|consistency|durability|security|privacy|compliance|governance|monitoring|logging|debugging|profiling|testing|validation|verification|documentation|specification|requirement|design|implementation|deployment|maintenance|support|troubleshooting|debugging|optimization|refactoring|migration|upgrade|deprecation|retirement|sunsetting)\b/gi);
    if (businessTerms) {
      businessTerms.forEach(term => keywords.add(term.toLowerCase()));
    }
  });

  const domainAnalysis = inferDomain(Array.from(participants), Array.from(methods), Array.from(keywords));

  return {
    participants: Array.from(participants),
    methods: Array.from(methods),
    keywords: Array.from(keywords),
    comments,
    domain: domainAnalysis
  };
}

function inferDomain(participants, methods, keywords) {
  const domainPatterns = {
    'E-commerce': ['order', 'cart', 'checkout', 'payment', 'product', 'customer', 'inventory', 'shipping'],
    'Authentication': ['login', 'logout', 'register', 'auth', 'user', 'password', 'token', 'session'],
    'Library Management': ['book', 'library', 'borrow', 'return', 'catalog', 'member', 'loan'],
    'Banking': ['account', 'transaction', 'transfer', 'balance', 'deposit', 'withdraw', 'payment'],
    'Content Management': ['content', 'article', 'post', 'publish', 'edit', 'draft', 'media'],
    'Communication': ['message', 'chat', 'email', 'notification', 'send', 'receive', 'broadcast'],
    'Data Processing': ['process', 'analyze', 'transform', 'import', 'export', 'sync', 'backup'],
    'API Integration': ['api', 'endpoint', 'request', 'response', 'service', 'client', 'server'],
    'User Management': ['user', 'profile', 'admin', 'role', 'permission', 'setting', 'preference'],
    'File Management': ['file', 'upload', 'download', 'storage', 'folder', 'document', 'media']
  };

  const allTerms = [...participants, ...methods, ...keywords].map(term => term.toLowerCase());
  
  let bestMatch = { domain: 'General', score: 0 };
  
  for (const [domain, patterns] of Object.entries(domainPatterns)) {
    const matches = patterns.filter(pattern => allTerms.some(term => term.includes(pattern)));
    const score = matches.length;
    
    if (score > bestMatch.score) {
      bestMatch = { domain, score };
    }
  }
  
  return bestMatch.domain;
}

function generateCacheKey(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

async function getCachedTitle(cacheKey) {
  try {
    const doc = await db.collection('title_cache').doc(cacheKey).get();
    if (doc.exists) {
      const data = doc.data();
      // Check if cache is still valid (24 hours)
      const now = Date.now();
      if (now - data.timestamp < 24 * 60 * 60 * 1000) {
        return data.title;
      }
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }
  return null;
}

async function setCachedTitle(cacheKey, title) {
  try {
    await db.collection('title_cache').doc(cacheKey).set({
      title,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

async function checkRateLimit(rateLimitKey) {
  try {
    const doc = await db.collection('rate_limits').doc(rateLimitKey).get();
    const now = Date.now();
    
    if (doc.exists) {
      const data = doc.data();
      const windowStart = now - (60 * 1000); // 1 minute window
      
      // Filter requests within the current window
      const recentRequests = (data.requests || []).filter(timestamp => timestamp > windowStart);
      
      if (recentRequests.length >= 10) { // Max 10 requests per minute
        return false;
      }
      
      // Add current request
      recentRequests.push(now);
      
      await db.collection('rate_limits').doc(rateLimitKey).set({
        requests: recentRequests
      });
    } else {
      // First request
      await db.collection('rate_limits').doc(rateLimitKey).set({
        requests: [now]
      });
    }
    
    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return false;
  }
}

async function callOpenAI(analysis, originalContent, apiKey) {
  const prompt = buildPrompt(analysis, originalContent);
  
  const requestOptions = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }
  };

  const postData = JSON.stringify({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that generates concise, descriptive titles for sequence diagrams. Keep titles under 50 characters and focus on the main business process or interaction.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 50,
    temperature: 0.7
  });

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            reject(new Error(`OpenAI API error: ${response.error?.message || 'Unknown error'}`));
            return;
          }
          
          const title = response.choices[0]?.message?.content?.trim();
          
          if (!title) {
            reject(new Error('Empty response from OpenAI'));
            return;
          }
          
          resolve(title.replace(/['"]/g, '').substring(0, 50));
        } catch (parseError) {
          reject(new Error(`Failed to parse OpenAI response: ${parseError.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`OpenAI request failed: ${error.message}`));
    });
    
    req.write(postData);
    req.end();
  });
}

function buildPrompt(analysis, originalContent) {
  const { participants, methods, keywords, comments, domain } = analysis;
  
  return `Generate a concise title for this sequence diagram:

Domain: ${domain}
Participants: ${participants.join(', ')}
Methods: ${methods.join(', ')}
Key Terms: ${keywords.slice(0, 10).join(', ')}
${comments.length > 0 ? `Comments: ${comments.join(' ')}` : ''}

Original content preview:
${originalContent.substring(0, 200)}...

Generate a title that captures the main business process or interaction. Keep it under 50 characters.`;
}

function generateFallbackTitle(analysis) {
  const { participants, methods, domain } = analysis;
  
  if (domain && domain !== 'General') {
    return `${domain} Flow`;
  }
  
  if (participants.length > 0 && methods.length > 0) {
    const primaryParticipant = participants[0];
    const primaryMethod = methods.find(m => 
      ['get', 'create', 'update', 'delete', 'process', 'handle', 'manage'].includes(m.toLowerCase())
    ) || methods[0];
    
    return `${primaryParticipant} ${primaryMethod}`;
  }
  
  if (participants.length > 0) {
    return `${participants[0]} Interaction`;
  }
  
  return 'Sequence Diagram';
}
