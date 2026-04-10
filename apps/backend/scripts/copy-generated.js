#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/generated');
const dest = path.join(__dirname, '../dist/src/generated');

function copyRecursive(srcPath, destPath) {
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }

  const files = fs.readdirSync(srcPath);
  files.forEach((file) => {
    const srcFile = path.join(srcPath, file);
    const destFile = path.join(destPath, file);
    const stats = fs.statSync(srcFile);

    if (stats.isDirectory()) {
      copyRecursive(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  });
}

try {
  copyRecursive(src, dest);
  console.log('✓ Generated files copied to dist');
} catch (error) {
  console.error('Failed to copy generated files:', error.message);
  process.exit(1);
}
