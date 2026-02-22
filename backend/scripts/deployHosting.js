/**
 * Deploy frontend to Firebase Hosting using service account credentials
 *
 * This bypasses the need for firebase login by using the Admin SDK
 *
 * Usage: node scripts/deployHosting.js
 */

const { admin } = require('../firebase');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const zlib = require('zlib');

const PROJECT_ID = 'sipsync-b400e';
const SITE_ID = 'sipsync-b400e'; // Usually same as project ID
const BUILD_DIR = path.join(__dirname, '../../frontend/build');

// Get all files recursively
function getAllFiles(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      const relativePath = '/' + path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const fileContent = fs.readFileSync(fullPath);
      const gzippedContent = require('zlib').gzipSync(fileContent);

      files.push({
        path: relativePath,
        fullPath: fullPath,
        content: gzippedContent,
        hash: crypto.createHash('sha256').update(gzippedContent).digest('hex')
      });
    }
  }

  return files;
}

async function deploy() {
  console.log('\n========================================');
  console.log('Firebase Hosting Deployment');
  console.log('========================================\n');

  try {
    // Get access token from service account
    console.log('→ Getting access token from service account...');
    const accessToken = await admin.app().options.credential.getAccessToken();
    const token = accessToken.access_token;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 1: Create new version
    console.log('→ Creating new hosting version...');
    const versionResponse = await axios.post(
      `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/versions`,
      {
        config: {
          rewrites: [{
            glob: '**',
            path: '/index.html'
          }]
        }
      },
      { headers }
    );

    const versionName = versionResponse.data.name;
    console.log(`✓ Version created: ${versionName}`);

    // Step 2: Get all files to upload
    console.log('\n→ Scanning build directory...');
    const files = getAllFiles(BUILD_DIR);
    console.log(`✓ Found ${files.length} files`);

    // Step 3: Populate files (tell Firebase what we're uploading)
    console.log('\n→ Populating file manifest...');
    const populateResponse = await axios.post(
      `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`,
      {
        files: files.reduce((acc, file) => {
          acc[file.path] = file.hash;
          return acc;
        }, {})
      },
      { headers }
    );

    const uploadUrl = populateResponse.data.uploadUrl;
    const uploadRequired = populateResponse.data.uploadRequiredHashes || [];

    console.log(`✓ ${uploadRequired.length} files need uploading (others cached)`);

    // Step 4: Upload files that need uploading
    if (uploadRequired.length > 0) {
      console.log('\n→ Uploading files...');

      for (const hash of uploadRequired) {
        const file = files.find(f => f.hash === hash);
        if (!file) continue;

        await axios.post(
          `${uploadUrl}/${hash}`,
          file.content,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/octet-stream'
            }
          }
        );

        process.stdout.write('.');
      }
      console.log('\n✓ Upload complete');
    }

    // Step 5: Finalize version
    console.log('\n→ Finalizing version...');
    await axios.patch(
      `https://firebasehosting.googleapis.com/v1beta1/${versionName}?update_mask=status`,
      {
        status: 'FINALIZED'
      },
      { headers }
    );
    console.log('✓ Version finalized');

    // Step 6: Release version (make it live)
    console.log('\n→ Releasing to live...');
    await axios.post(
      `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE_ID}/releases?versionName=${versionName}`,
      {},
      { headers }
    );

    console.log('\n========================================');
    console.log('Deployment Successful!');
    console.log('========================================\n');
    console.log(`Your site is live at: https://${SITE_ID}.web.app\n`);

  } catch (error) {
    console.error('\n✗ Deployment failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run deployment
deploy();
