// Generates the original source app icon (1024x1024 RGBA PNG) for TheNexus.
// The artwork is fully programmatic (radial nebula + 4-point nexus star + orbit ring),
// so it is original work with no third-party provenance. Run: node tools/generate-icon.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 1024;

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Supersample 2x2 per pixel for smoother edges.
const SS = 2;
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));

const lerp = (a, b, t) => a + (b - a) * t;

function sample(fx, fy) {
  // Coordinates centered at 0, radius in [0,1].
  const x = (fx / SIZE) * 2 - 1;
  const y = (fy / SIZE) * 2 - 1;
  const r = Math.hypot(x, y);

  // Deep space radial gradient: indigo core to near-black rim.
  const t = Math.min(1, r);
  let cr = lerp(58, 10, t);
  let cg = lerp(42, 14, t);
  let cb = lerp(110, 34, t);

  // Soft nebula glow (two offset lobes).
  const glow1 = Math.exp(-((x + 0.28) ** 2 + (y + 0.18) ** 2) * 4.2);
  const glow2 = Math.exp(-((x - 0.32) ** 2 + (y - 0.25) ** 2) * 5.6);
  cr += glow1 * 40 + glow2 * 26;
  cg += glow1 * 30 + glow2 * 44;
  cb += glow1 * 70 + glow2 * 82;

  // Star field (deterministic hash-based pinpoints).
  const cell = 37;
  const cx = Math.floor(((fx / SIZE) * cell) | 0);
  const cy = Math.floor(((fy / SIZE) * cell) | 0);
  const h = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453;
  const starSeed = h - Math.floor(h);
  if (starSeed > 0.985 && r < 0.98) {
    const scx = ((Math.floor(cx) + 0.5) / cell) * 2 - 1;
    const scy = ((Math.floor(cy) + 0.5) / cell) * 2 - 1;
    const sd = Math.hypot(x - scx, y - scy);
    const star = Math.exp(-sd * sd * 900);
    cr += star * 220;
    cg += star * 220;
    cb += star * 235;
  }

  // Orbit ring (ellipse), thin bright band.
  const ring = Math.abs(Math.hypot(x / 0.94, y / 0.94) - 0.82);
  if (ring < 0.02) {
    const ringGlow = Math.exp(-(ring * ring) * 5200);
    cr += ringGlow * 90;
    cg += ringGlow * 170;
    cb += ringGlow * 210;
  }

  // Central 4-point nexus star (vertical/horizontal rays + bright core).
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const ray = Math.min(ax / 0.78, ay / 0.14) <= 1 || Math.min(ax / 0.14, ay / 0.78) <= 1;
  const rayDist = Math.min(Math.max(ax / 0.78, ay / 0.14), Math.max(ax / 0.14, ay / 0.78));
  if (ray && rayDist <= 1) {
    const edge = 1 - rayDist;
    const rayGlow = Math.pow(edge, 1.6);
    cr = lerp(cr, 235, rayGlow * 0.9);
    cg = lerp(cg, 240, rayGlow * 0.9);
    cb = lerp(cb, 255, rayGlow * 0.9);
  }
  const core = Math.exp(-r * r * 26);
  cr = lerp(cr, 255, core);
  cg = lerp(cg, 250, core);
  cb = lerp(cb, 240, core);

  // Circular vignette mask with soft edge (icon shape).
  const alpha = r <= 0.96 ? 255 : r >= 1.0 ? 0 : clamp((1.0 - r) * 640);
  return [clamp(cr), clamp(cg), clamp(cb), alpha];
}

let offset = 0;
for (let py = 0; py < SIZE; py++) {
  raw[offset++] = 0; // filter: none
  for (let px = 0; px < SIZE; px++) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sa = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const [r, g, b, a] = sample(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
        sr += r;
        sg += g;
        sb += b;
        sa += a;
      }
    }
    const n = SS * SS;
    raw[offset++] = sr / n;
    raw[offset++] = sg / n;
    raw[offset++] = sb / n;
    raw[offset++] = sa / n;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'app-icon.png');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);
