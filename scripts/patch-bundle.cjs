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

// Configuration managed via root wrangler.toml
