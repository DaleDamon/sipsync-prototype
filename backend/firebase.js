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
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

const db = admin.firestore();
const auth = admin.auth();

let bucket = null;
try {
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    bucket = admin.storage().bucket();
  } else {
    console.warn('[Firebase] FIREBASE_STORAGE_BUCKET not set — storage features disabled');
  }
} catch (err) {
  console.warn('[Firebase] Storage bucket init failed (non-fatal):', err.message);
}

module.exports = { db, auth, admin, bucket };
