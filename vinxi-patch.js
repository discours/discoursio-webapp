// vinxi-patch.js
// Windows-only workaround for Vinxi manifest.json issue
const fs = require('fs');
const path = require('path');
const os = require('os');

// Only run on Windows
if (os.platform() !== 'win32') {
  console.log('⏭️  Skipping vinxi-patch (not Windows)');
  process.exit(0);
}

const manifestPath = path.join(__dirname, '.vinxi/build/server-fns/_server/manifest.js');
const jsonPath = path.join(__dirname, '.vinxi/build/server-fns/_server/manifest.json');

if (fs.existsSync(manifestPath) && !fs.existsSync(jsonPath)) {
  try {
    fs.copyFileSync(manifestPath, jsonPath);
    console.log('✓ Created manifest.json from manifest.js (Windows patch)');
  } catch (err) {
    console.error('❌ Failed to create manifest.json:', err.message);
    process.exit(1);
  }
} else if (fs.existsSync(jsonPath)) {
  console.log('✓ manifest.json already exists');
} else if (!fs.existsSync(manifestPath)) {
  console.warn('⚠️  manifest.js not found, build may have failed');
}