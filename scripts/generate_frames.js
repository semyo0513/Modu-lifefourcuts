import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    table[n] = c;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function encodeRGBAtoPNG(width, height, rgbaBuffer) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflated
  ihdrData[11] = 0; // adaptive filter
  ihdrData[12] = 0; // non-interlaced

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines: for each row, 1 byte filter type (0) + width * 4 bytes RGBA
  const rawScanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rawOffset = y * (1 + width * 4);
    rawScanlines[rawOffset] = 0; // Filter 0 (None)
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(rawScanlines, rawOffset + 1, srcOffset, srcOffset + width * 4);
  }

  const compressedData = zlib.deflateSync(rawScanlines, { level: 6 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

class FrameDrawer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4);
  }

  setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a === 255) {
      this.buffer[idx] = r;
      this.buffer[idx + 1] = g;
      this.buffer[idx + 2] = b;
      this.buffer[idx + 3] = a;
    } else {
      const srcA = a / 255;
      const dstA = this.buffer[idx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        this.buffer[idx] = Math.round((r * srcA + this.buffer[idx] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 1] = Math.round((g * srcA + this.buffer[idx + 1] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 2] = Math.round((b * srcA + this.buffer[idx + 2] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 3] = Math.round(outA * 255);
      }
    }
  }

  fillRect(x1, y1, w, h, r, g, b, a = 255) {
    const xEnd = Math.min(this.width, x1 + w);
    const yEnd = Math.min(this.height, y1 + h);
    for (let y = Math.max(0, y1); y < yEnd; y++) {
      for (let x = Math.max(0, x1); x < xEnd; x++) {
        this.setPixel(x, y, r, g, b, a);
      }
    }
  }

  clearSlot(x1, y1, w, h, radius = 8) {
    // Cutout transparent rectangle with rounded corners
    const xEnd = Math.min(this.width, x1 + w);
    const yEnd = Math.min(this.height, y1 + h);
    for (let y = Math.max(0, y1); y < yEnd; y++) {
      for (let x = Math.max(0, x1); x < xEnd; x++) {
        let inside = true;
        if (radius > 0) {
          if (x < x1 + radius && y < y1 + radius) {
            const dx = x - (x1 + radius);
            const dy = y - (y1 + radius);
            if (dx * dx + dy * dy > radius * radius) inside = false;
          } else if (x >= xEnd - radius && y < y1 + radius) {
            const dx = x - (xEnd - radius - 1);
            const dy = y - (y1 + radius);
            if (dx * dx + dy * dy > radius * radius) inside = false;
          } else if (x < x1 + radius && y >= yEnd - radius) {
            const dx = x - (x1 + radius);
            const dy = y - (yEnd - radius - 1);
            if (dx * dx + dy * dy > radius * radius) inside = false;
          } else if (x >= xEnd - radius && y >= yEnd - radius) {
            const dx = x - (xEnd - radius - 1);
            const dy = y - (yEnd - radius - 1);
            if (dx * dx + dy * dy > radius * radius) inside = false;
          }
        }
        if (inside) {
          const idx = (y * this.width + x) * 4;
          this.buffer[idx] = 0;
          this.buffer[idx + 1] = 0;
          this.buffer[idx + 2] = 0;
          this.buffer[idx + 3] = 0; // Alpha 0
        }
      }
    }
  }

  strokeSlot(x1, y1, w, h, borderWidth, r, g, b, a = 255) {
    // Inner/Outer border for slot
    this.fillRect(x1 - borderWidth, y1 - borderWidth, w + borderWidth * 2, borderWidth, r, g, b, a);
    this.fillRect(x1 - borderWidth, y1 + h, w + borderWidth * 2, borderWidth, r, g, b, a);
    this.fillRect(x1 - borderWidth, y1, borderWidth, h, r, g, b, a);
    this.fillRect(x1 + w, y1, borderWidth, h, r, g, b, a);
  }

  drawPatternStripes(r, g, b, a, step = 30) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if ((x + y) % step < 6) {
          this.setPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  toPNG() {
    return encodeRGBAtoPNG(this.width, this.height, this.buffer);
  }
}

// Ensure output dir
const framesDir = path.resolve('frames');
if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

// 1. Frame Pink (600 x 1800)
console.log('Generating frame_pink.png...');
const pink = new FrameDrawer(600, 1800);
// Soft pastel pink background #ffd1dc / #ff809b
pink.fillRect(0, 0, 600, 1800, 255, 214, 224, 255);
// Inner accent tone
pink.fillRect(15, 15, 570, 1770, 255, 235, 240, 255);
pink.drawPatternStripes(255, 182, 193, 70, 40);

// Slots
const pinkSlots = [
  { x: 40, y: 40, w: 520, h: 380 },
  { x: 40, y: 460, w: 520, h: 380 },
  { x: 40, y: 880, w: 520, h: 380 },
  { x: 40, y: 1300, w: 520, h: 380 }
];
pinkSlots.forEach(s => {
  pink.strokeSlot(s.x, s.y, s.w, s.h, 4, 255, 130, 155, 255);
  pink.clearSlot(s.x, s.y, s.w, s.h, 12);
});

// Bottom decoration bar
pink.fillRect(40, 1710, 520, 4, 255, 140, 165, 255);
fs.writeFileSync(path.join(framesDir, 'frame_pink.png'), pink.toPNG());

// 2. Frame Mono (600 x 1800)
console.log('Generating frame_mono.png...');
const mono = new FrameDrawer(600, 1800);
// Rich obsidian/black background #18181b
mono.fillRect(0, 0, 600, 1800, 24, 24, 27, 255);
// Subtle dark border line
mono.fillRect(20, 20, 560, 1760, 32, 32, 36, 255);

pinkSlots.forEach(s => {
  mono.strokeSlot(s.x, s.y, s.w, s.h, 4, 255, 255, 255, 230);
  mono.clearSlot(s.x, s.y, s.w, s.h, 6);
});

// Bottom divider
mono.fillRect(60, 1720, 480, 2, 180, 180, 180, 200);
fs.writeFileSync(path.join(framesDir, 'frame_mono.png'), mono.toPNG());

// 3. Frame Retro (600 x 1800)
console.log('Generating frame_retro.png...');
const retro = new FrameDrawer(600, 1800);
// Warm cream/kraft paper background #e8d8c3
retro.fillRect(0, 0, 600, 1800, 235, 218, 195, 255);
// Film strip borders (black sprocket borders on left & right)
retro.fillRect(0, 0, 26, 1800, 35, 30, 25, 255);
retro.fillRect(574, 0, 26, 1800, 35, 30, 25, 255);

// Sprocket holes
for (let y = 20; y < 1800; y += 45) {
  retro.fillRect(6, y, 14, 22, 235, 218, 195, 255);
  retro.fillRect(580, y, 14, 22, 235, 218, 195, 255);
}

pinkSlots.forEach(s => {
  retro.strokeSlot(s.x, s.y, s.w, s.h, 3, 70, 55, 45, 255);
  retro.clearSlot(s.x, s.y, s.w, s.h, 4);
});
fs.writeFileSync(path.join(framesDir, 'frame_retro.png'), retro.toPNG());

// 4. Frame Grid (1200 x 1600)
console.log('Generating frame_grid.png...');
const grid = new FrameDrawer(1200, 1600);
// Lavender pastel gradient #c4b5fd / #a78bfa
grid.fillRect(0, 0, 1200, 1600, 224, 215, 245, 255);
grid.fillRect(25, 25, 1150, 1550, 243, 238, 255, 255);
grid.drawPatternStripes(190, 170, 240, 50, 50);

const gridSlots = [
  { x: 50, y: 50, w: 530, h: 680 },
  { x: 620, y: 50, w: 530, h: 680 },
  { x: 50, y: 770, w: 530, h: 680 },
  { x: 620, y: 770, w: 530, h: 680 }
];

gridSlots.forEach(s => {
  grid.strokeSlot(s.x, s.y, s.w, s.h, 6, 139, 92, 246, 255);
  grid.clearSlot(s.x, s.y, s.w, s.h, 16);
});

// Bottom decorative ribbon
grid.fillRect(100, 1500, 1000, 4, 167, 139, 250, 255);
fs.writeFileSync(path.join(framesDir, 'frame_grid.png'), grid.toPNG());

console.log('All frames generated successfully!');
