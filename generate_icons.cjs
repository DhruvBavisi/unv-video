const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const input = path.join(__dirname, 'public/images/investigation-room/Game-logo.png');
const outDir = path.join(__dirname, 'public/icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function run() {
  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    { size: 180, name: 'apple-touch-icon.png' }
  ];

  for (const { size, name } of sizes) {
    let img = sharp(input)
      .resize(size, size, {
        fit: 'contain',
        background: '#0b0c0d'
      });
      
    if (size === 512) {
      img = img.png({ compressionLevel: 9, palette: true });
    }
    
    await img.toFile(path.join(outDir, name));
    console.log(`Generated ${name}`);
  }
}

run().catch(console.error);
