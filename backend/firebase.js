const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load Firebase credentials from file (local dev) or env variable (production/Render)
let serviceAccount;
const keyPath = path.join(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(keyPath)) {
  serviceAccount = require(keyPath);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} else {
  throw new Error('No Firebase credentials found. Provide serviceAccountKey.json or set FIREBASE_SERVICE_ACCOUNT_KEY env var.');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { db, auth, admin };
