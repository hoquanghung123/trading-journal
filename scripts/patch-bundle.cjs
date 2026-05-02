const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '../dist/client/_worker.js');

if (!fs.existsSync(bundlePath)) {
  console.log('Worker bundle not found at', bundlePath, '- skipping patch.');
  process.exit(0);
}

let content = fs.readFileSync(bundlePath, 'utf8');

console.log('Patching bundle to surface errors...');

// 1. Force message to be preserved even if unhandled
content = content.replace(
  'message: unhandled ? "HTTPError" : this.message',
  'message: this.message'
);

// 2. Force stack trace to be included even if debug is false
content = content.replace(
  'stack: debug && error.stack ? error.stack.split("\\n").map((l2) => l2.trim()) : void 0',
  'stack: error.stack ? error.stack.split("\\n").map((l2) => l2.trim()) : void 0'
);

fs.writeFileSync(bundlePath, content);
console.log('Bundle patched successfully.');

// 3. Fix wrangler.json in dist/client
try {
  const rootWranglerPath = path.join(__dirname, '../wrangler.json');
  const distWranglerPath = path.join(__dirname, '../dist/client/wrangler.json');
  if (fs.existsSync(rootWranglerPath)) {
    console.log('Overwriting dist/client/wrangler.json with root configuration...');
    fs.copyFileSync(rootWranglerPath, distWranglerPath);
    console.log('wrangler.json fixed.');
  }
} catch (err) {
  console.error('Failed to fix wrangler.json:', err);
}
