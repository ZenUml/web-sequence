const configByDomain = {
    'app.zenuml.com': {
        firebase: {
            apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
            authDomain: 'web-sequence-local.firebaseapp.com',
            databaseURL: 'https://web-sequence-local.firebaseio.com/',
            projectId: 'web-sequence-local',
            storageBucket: 'web-sequence-local.appspot.com',
            messagingSenderId: '542187884961'
        },
        paddleProduct: 551167, //ZenUML Pro
        features: {
            payment: false
        }
    },
    'kcpganeflmhffnlofpdmcjklmdpbbmef': { //Chrome extension hostname
        firebase: {
            apiKey: 'AIzaSyCBEg3VpY6UjXNnDzvXieSYx13Q63Rs-a0',
            authDomain: 'web-sequence-local.firebaseapp.com',
            databaseURL: 'https://web-sequence-local.firebaseio.com/',
            projectId: 'web-sequence-local',
            storageBucket: 'web-sequence-local.appspot.com',
            messagingSenderId: '542187884961'
        },
        paddleProduct: 551167, //ZenUML Pro
        features: {
            payment: false
        }
    },
    'staging.zenuml.com': {
        firebase: {
			apiKey: "AIzaSyBSbndSAWDI5yA14ZmzjHw6RjssZMf1NTM",
			authDomain: "staging-zenuml-27954.firebaseapp.com",
			databaseURL: "https://staging-zenuml-27954.firebaseio.com",
			projectId: "staging-zenuml-27954",
			storageBucket: "staging-zenuml.appspot.com",
			messagingSenderId: "937016595307"
		},
        paddleProduct: 552378, //Test Plan1
        features: {
            payment: false
        }
    }
};

const defaultConfig = {
    firebase: {
        apiKey: "AIzaSyBSbndSAWDI5yA14ZmzjHw6RjssZMf1NTM",
        authDomain: "staging-zenuml-27954.firebaseapp.com",
        databaseURL: "https://staging-zenuml-27954.firebaseio.com",
        projectId: "staging-zenuml-27954",
        storageBucket: "staging-zenuml.appspot.com",
        messagingSenderId: "937016595307"
    },
    paddleProduct: 552378, //Test Plan1
    features: {
        payment: true
    }
};

const domain = window.location.hostname;

const config = configByDomain[domain] || defaultConfig;

export default config
