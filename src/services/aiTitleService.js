import config from './configuration';
import '../firebaseInit';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/functions';

class AITitleService {
  constructor() {
    this.functions = null;
    this.generateTitleFunction = null;
  }

  initializeFirebase() {
    if (!this.functions) {
      this.functions = firebase.functions();
      
      // Use emulator for local development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        this.functions.useEmulator('localhost', 5001);
      }
      
      this.generateTitleFunction = this.functions.httpsCallable('generateTitle');
    }
  }

  async generateTitle(diagramContent) {
    if (!diagramContent || typeof diagramContent !== 'string') {
      throw new Error('Invalid diagram content provided');
    }

    // Initialize Firebase if not already done
    this.initializeFirebase();

    // Check if user is authenticated
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User must be authenticated to generate titles');
    }

    try {
      // Get user token for authentication
      const token = await user.getIdToken();
      
      // Call the Firebase function
      const response = await fetch(this.getFunctionUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          content: diagramContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.title;
    } catch (error) {
      console.error('AI title generation failed:', error);
      
      // Return fallback title for better UX
      return this.generateFallbackTitle(diagramContent);
    }
  }

  getFunctionUrl() {
    // Use local emulator for development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5001/staging-zenuml-27954/us-central1/generateTitle';
    }
    
    // Use production/staging function URL based on config
    const projectId = config.firebase.projectId;
    return `https://us-central1-${projectId}.cloudfunctions.net/generateTitle`;
  }

  generateFallbackTitle(content) {
    if (!content || typeof content !== 'string') {
      return 'Untitled Diagram';
    }

    const analysis = this.analyzeContent(content);
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

  analyzeContent(code) {
    const lines = code.split('\n').map(line => line.trim());
    const participants = new Set();
    const methods = new Set();
    const keywords = new Set();

    lines.forEach(line => {
      if (line.startsWith('//') || !line || line.startsWith('/*')) return;

      const methodCall = line.match(/(\w+)\.(\w+)\s*\(/);
      if (methodCall) {
        participants.add(methodCall[1]);
        methods.add(methodCall[2]);
      }

      const participant = line.match(/^(\w+)\s*$/);
      if (participant) {
        participants.add(participant[1]);
      }

      const businessTerms = line.match(/\b(get|create|update|delete|process|handle|manage|validate|authenticate|login|logout|register|book|user|library|order|payment|account|customer|product|service|api|database|auth|admin|dashboard|report|search|filter|export|import|notification|email|message|chat|upload|download|sync|backup|restore|config|setting|profile|cart|checkout|invoice|receipt|transaction|transfer|withdraw|deposit|balance|history|analytics|metric|log|error|warning|info|debug|trace|monitor|alert|health|status|version|release|deploy|build|test|dev|prod|staging|local|remote|cloud|server|client|web|mobile|desktop|app|system|platform|framework|library|tool|util|helper|service|component|module|plugin|extension|widget|control|element|item|entity|model|view|controller|route|middleware|filter|guard|interceptor|decorator|factory|builder|manager|handler|processor|validator|parser|formatter|serializer|deserializer|encoder|decoder|compressor|decompressor|optimizer|analyzer|generator|converter|transformer|mapper|adapter|wrapper|proxy|cache|store|repository|dao|dto|vo|bo|po|entity|aggregate|event|command|query|request|response|result|error|exception|success|failure|pending|loading|complete|cancel|timeout|retry|fallback|default|custom|standard|advanced|basic|simple|complex|manual|automatic|sync|async|batch|single|multi|global|local|public|private|internal|external|static|dynamic|virtual|abstract|concrete|interface|implementation|specification|definition|declaration|configuration|initialization|finalization|cleanup|setup|teardown|start|stop|pause|resume|reset|refresh|reload|update|upgrade|downgrade|migrate|rollback|commit|rollback|save|load|read|write|execute|run|invoke|call|send|receive|publish|subscribe|listen|watch|observe|trigger|emit|dispatch|broadcast|notify|alert|warn|info|debug|trace|log|audit|track|monitor|measure|count|sum|average|min|max|sort|filter|search|find|select|insert|update|delete|create|destroy|build|compile|parse|render|format|validate|verify|check|test|assert|expect|mock|stub|spy|fake|dummy|placeholder|template|example|sample|demo|prototype|proof|concept|idea|plan|design|architecture|pattern|best|practice|convention|standard|guideline|rule|policy|procedure|workflow|process|step|phase|stage|cycle|iteration|loop|condition|branch|merge|split|join|fork|clone|copy|move|rename|replace|swap|exchange|convert|transform|map|reduce|filter|fold|zip|unzip|pack|unpack|serialize|deserialize|encode|decode|encrypt|decrypt|hash|salt|token|key|secret|password|username|email|phone|address|name|title|description|comment|note|tag|label|category|type|kind|class|group|set|list|array|map|dict|hash|tree|graph|node|edge|link|path|route|url|uri|endpoint|resource|entity|object|value|property|attribute|field|column|row|record|document|file|folder|directory|project|workspace|environment|context|scope|namespace|package|module|library|framework|tool|utility|service|component|widget|control|element|item|entity|model|view|controller|presenter|viewmodel|adapter|wrapper|proxy|facade|decorator|observer|listener|handler|callback|promise|future|task|job|worker|thread|process|queue|stack|heap|memory|storage|database|cache|session|cookie|token|authorization|authentication|permission|role|user|admin|guest|anonymous|public|private|protected|internal|external|readonly|writeonly|readwrite|immutable|mutable|const|var|let|final|static|abstract|virtual|override|implement|extend|inherit|compose|mixin|trait|interface|class|struct|enum|union|tuple|record|generic|template|macro|annotation|attribute|metadata|reflection|introspection|serialization|deserialization|marshalling|unmarshalling|encoding|decoding|compression|decompression|optimization|performance|scalability|reliability|availability|consistency|durability|security|privacy|compliance|governance|monitoring|logging|debugging|profiling|testing|validation|verification|documentation|specification|requirement|design|implementation|deployment|maintenance|support|troubleshooting|debugging|optimization|refactoring|migration|upgrade|deprecation|retirement|sunsetting)\b/gi);
      if (businessTerms) {
        businessTerms.forEach(term => keywords.add(term.toLowerCase()));
      }
    });

    const domain = this.inferDomain(Array.from(participants), Array.from(methods), Array.from(keywords));

    return {
      participants: Array.from(participants),
      methods: Array.from(methods),
      keywords: Array.from(keywords),
      domain
    };
  }

  inferDomain(participants, methods, keywords) {
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
}

export default new AITitleService();