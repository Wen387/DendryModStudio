#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const desktopDir = path.resolve(__dirname, '..');
const outPath = path.join(desktopDir, 'assets', 'dendry-mod-studio.ico');
const iconSizes = [16, 24, 32, 48, 64, 128, 256];

function color(hex) {
  const value = String(hex || '').replace(/^#/, '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    255
  ];
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffers) {
  let crc = 0xffffffff;
  buffers.forEach((buffer) => {
    for (let i = 0; i < buffer.length; i += 1) {
      crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    }
  });
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32([typeBuffer, data]), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function pngFromRgba(width, height, rgba) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    rows[rowOffset] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(rows, rowOffset + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(rows, {level: 9})),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function blend(data, width, x, y, rgba) {
  if (x < 0 || y < 0 || x >= width || y >= width) {
    return;
  }
  const offset = (y * width + x) * 4;
  const alpha = rgba[3] / 255;
  const inverse = 1 - alpha;
  data[offset] = Math.round(rgba[0] * alpha + data[offset] * inverse);
  data[offset + 1] = Math.round(rgba[1] * alpha + data[offset + 1] * inverse);
  data[offset + 2] = Math.round(rgba[2] * alpha + data[offset + 2] * inverse);
  data[offset + 3] = Math.round(rgba[3] + data[offset + 3] * inverse);
}

function svgToPixel(value, scale) {
  return value * scale;
}

function fillRoundedRect(data, pixelSize, scale, x, y, width, height, radius, rgba) {
  const minX = Math.floor(svgToPixel(x, scale));
  const maxX = Math.ceil(svgToPixel(x + width, scale));
  const minY = Math.floor(svgToPixel(y, scale));
  const maxY = Math.ceil(svgToPixel(y + height, scale));
  for (let py = minY; py < maxY; py += 1) {
    const cy = (py + 0.5) / scale;
    for (let px = minX; px < maxX; px += 1) {
      const cx = (px + 0.5) / scale;
      const clampedX = Math.max(x + radius, Math.min(x + width - radius, cx));
      const clampedY = Math.max(y + radius, Math.min(y + height - radius, cy));
      const dx = cx - clampedX;
      const dy = cy - clampedY;
      if (dx * dx + dy * dy <= radius * radius) {
        blend(data, pixelSize, px, py, rgba);
      }
    }
  }
}

function fillCircle(data, pixelSize, scale, cx, cy, radius, rgba) {
  const minX = Math.floor(svgToPixel(cx - radius, scale));
  const maxX = Math.ceil(svgToPixel(cx + radius, scale));
  const minY = Math.floor(svgToPixel(cy - radius, scale));
  const maxY = Math.ceil(svgToPixel(cy + radius, scale));
  const radiusSq = radius * radius;
  for (let py = minY; py <= maxY; py += 1) {
    const y = (py + 0.5) / scale;
    for (let px = minX; px <= maxX; px += 1) {
      const x = (px + 0.5) / scale;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radiusSq) {
        blend(data, pixelSize, px, py, rgba);
      }
    }
  }
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const ox = px - x1;
    const oy = py - y1;
    return Math.sqrt(ox * ox + oy * oy);
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  const ox = px - x;
  const oy = py - y;
  return Math.sqrt(ox * ox + oy * oy);
}

function strokeLine(data, pixelSize, scale, x1, y1, x2, y2, width, rgba) {
  const radius = width / 2;
  const minX = Math.floor(svgToPixel(Math.min(x1, x2) - radius, scale));
  const maxX = Math.ceil(svgToPixel(Math.max(x1, x2) + radius, scale));
  const minY = Math.floor(svgToPixel(Math.min(y1, y2) - radius, scale));
  const maxY = Math.ceil(svgToPixel(Math.max(y1, y2) + radius, scale));
  for (let py = minY; py <= maxY; py += 1) {
    const y = (py + 0.5) / scale;
    for (let px = minX; px <= maxX; px += 1) {
      const x = (px + 0.5) / scale;
      if (distanceToSegment(x, y, x1, y1, x2, y2) <= radius) {
        blend(data, pixelSize, px, py, rgba);
      }
    }
  }
}

function cubicPoint(t, p0, p1, p2, p3) {
  const inverse = 1 - t;
  return inverse * inverse * inverse * p0
    + 3 * inverse * inverse * t * p1
    + 3 * inverse * t * t * p2
    + t * t * t * p3;
}

function strokeCubic(data, pixelSize, scale, start, c1, c2, end, width, rgba) {
  const steps = Math.max(36, Math.round(pixelSize / 2));
  let previous = start;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const point = [
      cubicPoint(t, start[0], c1[0], c2[0], end[0]),
      cubicPoint(t, start[1], c1[1], c2[1], end[1])
    ];
    strokeLine(data, pixelSize, scale, previous[0], previous[1], point[0], point[1], width, rgba);
    previous = point;
  }
}

function downsample(source, sourceSize, targetSize, oversample) {
  const output = new Uint8ClampedArray(targetSize * targetSize * 4);
  const samples = oversample * oversample;
  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < oversample; sy += 1) {
        for (let sx = 0; sx < oversample; sx += 1) {
          const sourceOffset = ((y * oversample + sy) * sourceSize + (x * oversample + sx)) * 4;
          r += source[sourceOffset];
          g += source[sourceOffset + 1];
          b += source[sourceOffset + 2];
          a += source[sourceOffset + 3];
        }
      }
      const offset = (y * targetSize + x) * 4;
      output[offset] = Math.round(r / samples);
      output[offset + 1] = Math.round(g / samples);
      output[offset + 2] = Math.round(b / samples);
      output[offset + 3] = Math.round(a / samples);
    }
  }
  return output;
}

function renderIcon(size) {
  const oversample = size <= 32 ? 8 : 4;
  const pixelSize = size * oversample;
  const scale = pixelSize / 128;
  const data = new Uint8ClampedArray(pixelSize * pixelSize * 4);
  const background = color('#24353b');
  const branchGold = color('#e8d8a5');
  const branchLight = color('#e7f1ea');
  const accent = color('#c95f4b');

  fillRoundedRect(data, pixelSize, scale, 0, 0, 128, 128, 24, background);
  strokeCubic(data, pixelSize, scale, [28, 76], [28, 52], [43, 33], [64, 33], 9, branchGold);
  strokeCubic(data, pixelSize, scale, [64, 33], [85, 33], [100, 52], [100, 76], 9, branchGold);
  strokeLine(data, pixelSize, scale, 64, 32, 64, 96, 8, branchLight);
  strokeLine(data, pixelSize, scale, 42, 50, 64, 68, 8, branchLight);
  strokeLine(data, pixelSize, scale, 64, 68, 86, 50, 8, branchLight);
  strokeLine(data, pixelSize, scale, 36, 78, 92, 78, 8, branchLight);
  fillCircle(data, pixelSize, scale, 64, 96, 8, accent);

  return downsample(data, pixelSize, size, oversample);
}

function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  const bodies = [];
  let offset = 6 + count * 16;
  images.forEach((image) => {
    const body = pngFromRgba(image.size, image.size, image.rgba);
    const entry = Buffer.alloc(16);
    entry[0] = image.size === 256 ? 0 : image.size;
    entry[1] = image.size === 256 ? 0 : image.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(body.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += body.length;
    entries.push(entry);
    bodies.push(body);
  });

  return Buffer.concat([header, ...entries, ...bodies]);
}

function main() {
  const images = iconSizes.map((size) => ({size, rgba: renderIcon(size)}));
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, buildIco(images));
  console.log(JSON.stringify({ok: true, path: outPath, sizes: iconSizes}, null, 2));
}

main();
