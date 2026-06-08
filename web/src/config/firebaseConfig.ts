// Host → Firebase/Paddle config. Ported verbatim from the legacy app's
// repo-root `src/services/configuration.js` (see contract spec §1). All values
// are PUBLIC Firebase web keys + Paddle product IDs already shipped in the
// client bundle — no secret handling needed. Keep value-for-value identical to
// the legacy file; the per-host authDomain/storageBucket differences are
// intentional, not inconsistencies to "fix".

export interface AppConfig {
  firebase: {
    apiKey: string; authDomain: string; databaseURL?: string;
    projectId: string; storageBucket: string; messagingSenderId: string; appId?: string;
  };
  paddleProductBasicMonthly: string;
  paddleProductPlusMonthly: string;
  paddleProductBasicYearly: string;
  paddleProductPlusYearly: string;
  features: { payment: boolean };
}

const configByDomain: Record<string, AppConfig> = {
  'app.zenuml.com': {
    firebase: {
      apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
      authDomain: 'app.zenuml.com',
      databaseURL: 'https://web-sequence-local.firebaseio.com/',
      projectId: 'web-sequence-local',
      storageBucket: 'web-sequence-local.appspot.com',
      messagingSenderId: '542187884961',
    },
    paddleProductBasicMonthly: '879334',
    paddleProductPlusMonthly: '883078',
    paddleProductBasicYearly: '879927',
    paddleProductPlusYearly: '883082',
    features: { payment: true },
  },
  // Chrome extension hostname
  kcpganeflmhffnlofpdmcjklmdpbbmef: {
    firebase: {
      apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
      authDomain: 'web-sequence-local.firebaseapp.com',
      databaseURL: 'https://web-sequence-local.firebaseio.com/',
      projectId: 'web-sequence-local',
      storageBucket: 'web-sequence-local.appspot.com',
      messagingSenderId: '542187884961',
    },
    paddleProductBasicMonthly: '879334',
    paddleProductPlusMonthly: '883078',
    paddleProductBasicYearly: '879927',
    paddleProductPlusYearly: '883082',
    features: { payment: false },
  },
  // Edge extension hostname (local)
  dkbmlkgijbidhjiojpmfchklncgimlpd: {
    firebase: {
      apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
      authDomain: 'web-sequence-local.firebaseapp.com',
      databaseURL: 'https://web-sequence-local.firebaseio.com/',
      projectId: 'web-sequence-local',
      storageBucket: 'web-sequence-local.appspot.com',
      messagingSenderId: '542187884961',
    },
    paddleProductBasicMonthly: '879334',
    paddleProductPlusMonthly: '883078',
    paddleProductBasicYearly: '879927',
    paddleProductPlusYearly: '883082',
    features: { payment: false },
  },
  // Edge extension hostname (in store)
  lbdlpjkkjmclkacflkdoaacpafjdiido: {
    firebase: {
      apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
      authDomain: 'web-sequence-local.firebaseapp.com',
      databaseURL: 'https://web-sequence-local.firebaseio.com/',
      projectId: 'web-sequence-local',
      storageBucket: 'web-sequence-local.appspot.com',
      messagingSenderId: '542187884961',
    },
    paddleProductBasicMonthly: '879334',
    paddleProductPlusMonthly: '883078',
    paddleProductBasicYearly: '879927',
    paddleProductPlusYearly: '883082',
    features: { payment: false },
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
    paddleProductBasicMonthly: '552378',
    paddleProductPlusMonthly: '882893',
    paddleProductBasicYearly: '882890',
    paddleProductPlusYearly: '882891',
    features: { payment: true },
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
    paddleProductBasicMonthly: '552378',
    paddleProductPlusMonthly: '882893',
    paddleProductBasicYearly: '882890',
    paddleProductPlusYearly: '882891',
    features: { payment: true },
  },
};

const defaultConfig: AppConfig = {
  firebase: {
    apiKey: 'AIzaSyC6s6r7KJeIK_8eGP469CK2Q5_X1XcFXdY',
    authDomain: 'staging.zenuml.com',
    databaseURL: 'https://staging-zenuml-27954.firebaseio.com',
    projectId: 'staging-zenuml-27954',
    storageBucket: 'staging-zenuml.appspot.com',
    messagingSenderId: '937016595307',
  },
  paddleProductBasicMonthly: '552378',
  paddleProductPlusMonthly: '882893',
  paddleProductBasicYearly: '882890',
  paddleProductPlusYearly: '882891',
  features: { payment: true },
};

export function resolveConfig(hostname: string = window.location.hostname): AppConfig {
  return configByDomain[hostname] ?? defaultConfig;
}

export const config = resolveConfig();
