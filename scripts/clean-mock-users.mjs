import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';
import process from 'node:process';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const rootCollection = 'CMG-IT-MANAGEMENT';
const rootDoc = 'root';

const mockIds = [
  'marcus-sterling',
  'elena-rodriguez',
  'jordan-chen',
  'sarah-adelson',
  'david-miller'
];

async function run() {
  for (const id of mockIds) {
    try {
      await deleteDoc(doc(db, rootCollection, rootDoc, 'users', id));
      console.log('Deleted mock user:', id);
    } catch (e) {
      console.log('Error deleting:', id, e.message);
    }
  }
  console.log('Done cleaning mock users.');
}

run();
