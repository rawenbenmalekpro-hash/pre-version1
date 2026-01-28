#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const FILES = [
  { src: '../node_modules/d3/dist/d3.min.js', dest: 'js/vendor/d3.v7.min.js' },
  { src: '../node_modules/topojson-client/dist/topojson-client.min.js', dest: 'js/vendor/topojson-client.min.js' },
  { src: '../node_modules/world-atlas/countries-110m.json', dest: 'data/world.topojson' },

  // Universes (V1 parity)
  { src: '../node_modules/three/build/three.module.js', dest: 'js/vendor/three.module.js' }
];

console.log('🌿 PlantWallK Setup\n');

if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
  console.error('❌ node_modules not found. Run "npm install" first.\n');
  process.exit(1);
}

['js/vendor', 'data'].forEach(dir => {
  const fullPath = path.join(ROOT, dir);
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
});

FILES.forEach(f => {
  const src = path.join(ROOT, f.src);
  const dest = path.join(ROOT, f.dest);
  if (!fs.existsSync(src)) { console.log(`❌ Not found: ${f.src}`); return; }
  fs.copyFileSync(src, dest);
  console.log(`✓ ${path.basename(dest)}`);
});

console.log('\n✅ Setup complete!');
console.log('Run: npm run serve');
console.log('Open: http://localhost:8080\n');
