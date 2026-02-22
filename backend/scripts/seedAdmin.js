// Usage: node scripts/seedAdmin.js <email> <password>
// Creates a superadmin account in Firestore

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { db } = require('../firebase');

async function seedAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: node scripts/seedAdmin.js <email> <password>');
    process.exit(1);
  }

  try {
    // Check if admin already exists
    const existing = await db.collection('admins').doc(email).get();
    if (existing.exists) {
      console.log(`Admin ${email} already exists. Updating password...`);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await db.collection('admins').doc(email).set({
      email,
      passwordHash,
      role: 'superadmin',
      restaurantId: null,
      createdAt: new Date()
    });

    console.log(`Super admin created successfully: ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

seedAdmin();
