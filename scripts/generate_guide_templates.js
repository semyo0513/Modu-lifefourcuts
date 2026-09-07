import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  return table;
}
const crcTable = createCrcTable();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4);
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}
function encodeRGBAtoPNG(width, height, rgbaBuffer) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const rawScanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (1 + width * 4)] = 0;
    const srcOffset = y * width * 4;
    rgbaBuffer.copy(rawScanlines, y * (1 + width * 4) + 1, srcOffset, srcOffset + width * 4);
  }
  const idatChunk = makeChunk('IDAT', zlib.deflateSync(rawScanlines, { level: 6 }));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

class GuideDrawer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 4);
  }
  fill(x1, y1, w, h, r, g, b, a = 255) {
    const xEnd = Math.min(this.w, x1 + w);
    const yEnd = Math.min(this.h, y1 + h);
    for (let y = Math.max(0, y1); y < yEnd; y++) {
      for (let x = Math.max(0, x1); x < xEnd; x++) {
        const idx = (y * this.w + x) * 4;
        this.buf[idx] = r;
        this.buf[idx + 1] = g;
        this.buf[idx + 2] = b;
        this.buf[idx + 3] = a;
      }
    }
  }
  drawChecker(x1, y1, w, h, size = 20) {
    const xEnd = Math.min(this.w, x1 + w);
    const yEnd = Math.min(this.h, y1 + h);
    for (let y = Math.max(0, y1); y < yEnd; y++) {
      for (let x = Math.max(0, x1); x < xEnd; x++) {
        const isWhite = (Math.floor((x - x1) / size) + Math.floor((y - y1) / size)) % 2 === 0;
        const col = isWhite ? 240 : 210;
        const idx = (y * this.w + x) * 4;
        this.buf[idx] = col;
        this.buf[idx + 1] = col;
        this.buf[idx + 2] = col;
        this.buf[idx + 3] = 255;
      }
    }
  }
  drawBorder(x1, y1, w, h, bw, r, g, b, a = 255) {
    this.fill(x1, y1, w, bw, r, g, b, a);
    this.fill(x1, y1 + h - bw, w, bw, r, g, b, a);
    this.fill(x1, y1, bw, h, r, g, b, a);
    this.fill(x1 + w - bw, y1, bw, h, r, g, b, a);
  }
  toPNG() {
    return encodeRGBAtoPNG(this.w, this.h, this.buf);
  }
}

// 1. 4컷 세로 스트립 제작 가이드 템플릿 (600x1800)
const stripGuide = new GuideDrawer(600, 1800);
stripGuide.fill(0, 0, 600, 1800, 230, 235, 245, 255); // 프레임 영역 (하늘빛 안내색)

const stripSlots = [
  { x: 40, y: 40, w: 520, h: 380 },
  { x: 40, y: 460, w: 520, h: 380 },
  { x: 40, y: 880, w: 520, h: 380 },
  { x: 40, y: 1300, w: 520, h: 380 }
];

stripSlots.forEach(s => {
  stripGuide.drawChecker(s.x, s.y, s.w, s.h, 15);
  stripGuide.drawBorder(s.x, s.y, s.w, s.h, 3, 239, 68, 68, 255);
});
stripGuide.fill(40, 1700, 520, 80, 200, 215, 235, 255);
stripGuide.drawBorder(40, 1700, 520, 80, 2, 59, 130, 246, 255);

fs.writeFileSync(path.resolve('frames/template_guide_strip.png'), stripGuide.toPNG());
console.log('Template guide generated: frames/template_guide_strip.png');

// 2. 2x2 그리드 가이드 템플릿 (1200x1600)
const gridGuide = new GuideDrawer(1200, 1600);
gridGuide.fill(0, 0, 1200, 1600, 230, 235, 245, 255);

const gridSlots = [
  { x: 50, y: 50, w: 530, h: 680 },
  { x: 620, y: 50, w: 530, h: 680 },
  { x: 50, y: 770, w: 530, h: 680 },
  { x: 620, y: 770, w: 530, h: 680 }
];

gridSlots.forEach(s => {
  gridGuide.drawChecker(s.x, s.y, s.w, s.h, 25);
  gridGuide.drawBorder(s.x, s.y, s.w, s.h, 4, 139, 92, 246, 255);
});
gridGuide.fill(80, 1470, 1040, 100, 200, 215, 235, 255);
gridGuide.drawBorder(80, 1470, 1040, 100, 3, 59, 130, 246, 255);

fs.writeFileSync(path.resolve('frames/template_guide_grid.png'), gridGuide.toPNG());
console.log('Template guide generated: frames/template_guide_grid.png');
