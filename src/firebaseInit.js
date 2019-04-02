import firebase from 'firebase/app';
import config from './services/configuration';

firebase.initializeApp(config.firebase);
