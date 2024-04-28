const configByDomain = {
  'app.zenuml.com': {
    firebase: {
      apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
      authDomain: 'app.zenuml.com',
      databaseURL: 'https://web-sequence-local.firebaseio.com/',
      projectId: 'web-sequence-local',
      storageBucket: 'web-sequence-local.appspot.com',
      messagingSenderId: '542187884961',
    },
    paddleProduct: 551167, //ZenUML Pro
    features: {
      payment: true,
    },
  },
  kcpganeflmhffnlofpdmcjklmdpbbmef: {
    //Chrome extension hostname
    firebase: {
      apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
      authDomain: 'web-sequence-local.firebaseapp.com',
      databaseURL: 'https://web-sequence-local.firebaseio.com/',
      projectId: 'web-sequence-local',
      storageBucket: 'web-sequence-local.appspot.com',
      messagingSenderId: '542187884961',
    },
    paddleProduct: 551167, //ZenUML Pro
    features: {
      payment: false,
    },
  },
  dkbmlkgijbidhjiojpmfchklncgimlpd: {
    //Edge extension hostname local
    firebase: {
      apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
      authDomain: 'web-sequence-local.firebaseapp.com',
      databaseURL: 'https://web-sequence-local.firebaseio.com/',
      projectId: 'web-sequence-local',
      storageBucket: 'web-sequence-local.appspot.com',
      messagingSenderId: '542187884961',
    },
    paddleProduct: 551167, //ZenUML Pro
    features: {
      payment: false,
    },
  },
  lbdlpjkkjmclkacflkdoaacpafjdiido: {
    //Edge extension hostname in store
    firebase: {
      apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
      authDomain: 'web-sequence-local.firebaseapp.com',
      databaseURL: 'https://web-sequence-local.firebaseio.com/',
      projectId: 'web-sequence-local',
      storageBucket: 'web-sequence-local.appspot.com',
      messagingSenderId: '542187884961',
    },
    paddleProduct: 551167, //ZenUML Pro
    features: {
      payment: false,
    },
  },
  'staging.zenuml.com': {
    firebase: {
      apiKey: 'AIzaSyC6s6r7KJeIK_8eGP469CK2Q5_X1XcFXdY',
      authDomain: 'staging.zenuml.com',
      databaseURL: 'https://staging-zenuml-27954.firebaseio.com',
      projectId: 'staging-zenuml-27954',
      storageBucket: 'staging-zenuml.appspot.com',
      messagingSenderId: '937016595307',
    },
    paddleProduct: 552378, //Test Plan1
    features: {
      payment: true,
    },
  },
  'web-sequence-dev.web.app': {
    firebase: {
      apiKey: 'AIzaSyAeI0cwZ1e5DdJDH3NDVrm01Zjvoa9ys40',
      authDomain: 'web-sequence-dev.firebaseapp.com',
      projectId: 'web-sequence-dev',
      storageBucket: 'web-sequence-dev.appspot.com',
      messagingSenderId: '269086080449',
      appId: '1:269086080449:web:524e822dbd66f7bb594340',
    },
    paddleProduct: 552378, //Test Plan1
    features: {
      payment: true,
    },
  },
};

const defaultConfig = {
  firebase: {
    apiKey: 'AIzaSyC6s6r7KJeIK_8eGP469CK2Q5_X1XcFXdY',
    authDomain: 'staging.zenuml.com',
    databaseURL: 'https://staging-zenuml-27954.firebaseio.com',
    projectId: 'staging-zenuml-27954',
    storageBucket: 'staging-zenuml.appspot.com',
    messagingSenderId: '937016595307',
  },
  paddleProductBasicMonthly: 'pro_01hwh74tng14hkwpmyr346fdqp', //Test Plan1
  paddleProductPlusMonthly: 'pro_01hwh7sh9zm3zjtprwwmr8ayyj', //Test Plan1
  paddleProductBasicYearly: 'pro_01hwh7b9xhfhr1r0q47en6watg', //Test Plan1
  paddleProductPlusYearly: 'pro_01hwh7w73vd8av1x0tft21jxxg', //Test Plan1
  features: {
    payment: true,
  },
};

const domain = window.location.hostname;

const config = configByDomain[domain] || defaultConfig;

export default config;
