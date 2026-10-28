import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer with 1 extra byte per scanline for filter byte (0 = None)
  const rowStride = width * 4 + 1;
  const rawData = Buffer.alloc(rowStride * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter type 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // CRC32 implementation
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);
    return Buffer.concat([len, combined, crcBuf]);
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: width(4), height(4), bitDepth(1), colorType(1 = 6 RGBA), comp(1), filter(1), interlace(1)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Draw futuristic Pulsar Bot icon
function drawPulsarIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5;
  const cy = 0.5;
  const dx = nx - cx;
  const dy = ny - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background gradient: Deep Obsidian (#030712) to Deep Teal (#042f2e)
  let r = 3 + Math.floor(nx * 12);
  let g = 7 + Math.floor(ny * 35);
  let b = 18 + Math.floor((1 - dist) * 35);
  let a = 255;

  // Outer glowing ring
  const ringDist = Math.abs(dist - 0.38);
  if (ringDist < 0.015) {
    const intensity = 1 - ringDist / 0.015;
    r = Math.min(255, r + Math.floor(20 * intensity));
    g = Math.min(255, g + Math.floor(184 * intensity));
    b = Math.min(255, b + Math.floor(166 * intensity));
  }

  // Bot head box (center: 0.5, 0.48, width: 0.38, height: 0.32)
  const headLeft = 0.31;
  const headRight = 0.69;
  const headTop = 0.34;
  const headBottom = 0.64;

  const inHead = nx >= headLeft && nx <= headRight && ny >= headTop && ny <= headBottom;

  if (inHead) {
    // Smooth corner check
    const cornerR = 0.08;
    const nearCornerX = nx < headLeft + cornerR ? headLeft + cornerR - nx : nx > headRight - cornerR ? nx - (headRight - cornerR) : 0;
    const nearCornerY = ny < headTop + cornerR ? headTop + cornerR - ny : ny > headBottom - cornerR ? ny - (headBottom - cornerR) : 0;
    
    if (nearCornerX * nearCornerX + nearCornerY * nearCornerY < cornerR * cornerR) {
      r = 15;
      g = 23;
      b = 42; // #0f172a

      // Border highlight
      const onBorder = nx <= headLeft + 0.02 || nx >= headRight - 0.02 || ny <= headTop + 0.02 || ny >= headBottom - 0.02;
      if (onBorder) {
        r = 20; g = 184; b = 166; // Teal border
      }

      // Visor / Eyes (ny: 0.42 to 0.48)
      if (ny >= 0.41 && ny <= 0.49 && nx >= 0.36 && nx <= 0.64) {
        r = 2; g = 6; b = 23; // dark visor
        // Eye 1
        const eye1Dist = Math.sqrt((nx - 0.43) * (nx - 0.43) + (ny - 0.45) * (ny - 0.45));
        const eye2Dist = Math.sqrt((nx - 0.57) * (nx - 0.57) + (ny - 0.45) * (ny - 0.45));
        if (eye1Dist < 0.03 || eye2Dist < 0.03) {
          r = 45; g = 212; b = 191; // glowing cyan #2dd4bf
        }
      }

      // Medical billing plus / cross on chest (ny: 0.53 to 0.60)
      const inCrossH = ny >= 0.55 && ny <= 0.58 && nx >= 0.44 && nx <= 0.56;
      const inCrossV = nx >= 0.485 && nx <= 0.515 && ny >= 0.52 && ny <= 0.61;
      if (inCrossH || inCrossV) {
        r = 16; g = 185; b = 129; // emerald #10b981
      }
    }
  }

  // Antenna (nx: 0.49 to 0.51, ny: 0.23 to 0.34)
  if (nx >= 0.49 && nx <= 0.51 && ny >= 0.24 && ny <= 0.34) {
    r = 20; g = 184; b = 166;
  }
  // Antenna orb
  const antOrbDist = Math.sqrt((nx - 0.5) * (nx - 0.5) + (ny - 0.22) * (ny - 0.22));
  if (antOrbDist < 0.035) {
    r = 45; g = 212; b = 191;
  }

  // Vital soundwave / ECG pulse line below head (ny: 0.76 to 0.84)
  if (ny >= 0.74 && ny <= 0.82 && nx >= 0.22 && nx <= 0.78) {
    // Pulse calculation
    let targetY = 0.78;
    if (nx > 0.40 && nx < 0.46) targetY = 0.74; // peak up
    else if (nx >= 0.46 && nx < 0.54) targetY = 0.82; // trough down
    else if (nx >= 0.54 && nx < 0.60) targetY = 0.75; // second spike

    if (Math.abs(ny - targetY) < 0.012) {
      r = 34; g = 211; b = 238; // cyan
    }
  }

  return [r, g, b, a];
}

// Generate all standard PWA icons
const publicDir = './public';
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA icons...');

fs.writeFileSync(`${publicDir}/pwa-192x192.png`, createPng(192, 192, drawPulsarIcon));
console.log('✓ Generated public/pwa-192x192.png');

fs.writeFileSync(`${publicDir}/pwa-512x512.png`, createPng(512, 512, drawPulsarIcon));
console.log('✓ Generated public/pwa-512x512.png');

fs.writeFileSync(`${publicDir}/pwa-maskable-512x512.png`, createPng(512, 512, drawPulsarIcon));
console.log('✓ Generated public/pwa-maskable-512x512.png');

fs.writeFileSync(`${publicDir}/apple-touch-icon.png`, createPng(180, 180, drawPulsarIcon));
console.log('✓ Generated public/apple-touch-icon.png');

console.log('All PWA icon assets generated successfully!');
