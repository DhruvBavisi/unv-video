const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'images', 'characters');
const files = fs.readdirSync(dir).filter(f => f.endsWith('-bg.png'));

async function analyze() {
  const results = {};
  for (const file of files) {
    const filePath = path.join(dir, file);
    const { info, data } = await sharp(filePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
    
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * 4;
        const a = data[idx + 3];
        if (a > 10) { 
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    
    const visibleHeight = maxY - minY + 1;
    const padBottom = info.height - 1 - maxY;
    
    const scale = info.height / visibleHeight;
    const translateY = (padBottom / info.height) * 100;
    
    results[file] = {
      scale: parseFloat(scale.toFixed(3)),
      translateY: parseFloat(translateY.toFixed(3))
    };
  }
  
  console.log(JSON.stringify(results, null, 2));
}

analyze().catch(console.error);
