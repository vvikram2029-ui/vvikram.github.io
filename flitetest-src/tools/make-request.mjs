// Queue an .ork for the site from the command line (same thing the site's Import button does).
//   SITE_PASSWORD=... node flitetest-src/tools/make-request.mjs rocket.ork "Display name" ["note"] [rail_m]
// Writes flitetest-src/inbox/<timestamp>_<name>.ork.enc; commit + push it and the GitHub Action runs the sweep.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { webcrypto as wc } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const [ork, name, note = '', rail = '1.83'] = process.argv.slice(2);
const PW = process.env.SITE_PASSWORD;
if (!ork || !PW) { console.error('usage: SITE_PASSWORD=... node make-request.mjs rocket.ork "Name" ["note"] [rail_m]'); process.exit(2); }
const req = { type: 'ork', name: name || path.basename(ork, '.ork'), note, rail: +rail, filename: path.basename(ork), by: 'command line', ork_b64: fs.readFileSync(ork).toString('base64') };
const salt = wc.getRandomValues(new Uint8Array(16)), iv = wc.getRandomValues(new Uint8Array(12));
const base = await wc.subtle.importKey('raw', new TextEncoder().encode(PW), 'PBKDF2', false, ['deriveKey']);
const key = await wc.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const ct = Buffer.from(await wc.subtle.encrypt({ name: 'AES-GCM', iv }, key, zlib.gzipSync(Buffer.from(JSON.stringify(req)))));
const inbox = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../inbox');
const out = path.join(inbox, `${new Date().toISOString().replace(/[:.]/g, '-')}_${req.name.replace(/[^\w-]+/g, '_').slice(0, 40)}.ork.enc`);
fs.writeFileSync(out, Buffer.concat([salt, iv, ct]));
console.log('Wrote', out);
