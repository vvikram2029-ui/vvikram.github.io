// flitetest build pipeline (run by .github/workflows/flitetest.yml, Node 20+, no npm deps).
//
//   SITE_PASSWORD=... node flitetest-src/pipeline.mjs [--jar OpenRocket.jar --cls classesDir]
//
// 1. Decrypts flitetest/payload.bin (salt16 | iv12 | AES-256-GCM(gzip(JSON))).
// 2. Replaces the app css/html/js with flitetest-src/app/* and the site config with config.json.
// 3. Processes every encrypted request in flitetest-src/inbox/ (same encryption as the payload):
//      {type:'ork', name, note, filename, ork_b64, rail?, by?}  -> run the 123-run wind sweep, add a version
//      {type:'delete', key, by?}                                 -> remove an imported version
// 4. Re-encrypts with a fresh salt/iv and deletes the processed inbox files.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { webcrypto as wc } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAYLOAD = path.join(ROOT, 'flitetest/payload.bin');
const SRC = path.join(ROOT, 'flitetest-src');
const INBOX = path.join(SRC, 'inbox');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const JAR = args.jar || 'OpenRocket.jar', CLS = args.cls || 'ft-classes';
const PW = process.env.SITE_PASSWORD;
if (!PW) { console.error('SITE_PASSWORD is not set'); process.exit(2); }

/* ---------- crypto (must match flitetest/index.html) ---------- */
async function keyFor(salt) {
  const base = await wc.subtle.importKey('raw', new TextEncoder().encode(PW), 'PBKDF2', false, ['deriveKey']);
  return wc.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function decrypt(buf) {
  const salt = buf.subarray(0, 16), iv = buf.subarray(16, 28), ct = buf.subarray(28);
  const plain = Buffer.from(await wc.subtle.decrypt({ name: 'AES-GCM', iv }, await keyFor(salt), ct));
  return JSON.parse(zlib.gunzipSync(plain).toString('utf8'));
}
async function encrypt(obj) {
  const salt = wc.getRandomValues(new Uint8Array(16)), iv = wc.getRandomValues(new Uint8Array(12));
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 });
  const ct = Buffer.from(await wc.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(salt), gz));
  return Buffer.concat([salt, iv, ct]);
}

/* ---------- helpers ---------- */
const r = (x, n = 3) => (x === null || x === undefined || !isFinite(x) ? null : Math.round(x * 10 ** n) / 10 ** n);
const slug = s => (s || 'rocket').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'rocket';
const today = () => new Date().toISOString().slice(0, 10);
function parseCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const head = lines.shift().split(',');
  return lines.map(l => { const v = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = v[i] === 'NaN' ? null : +v[i]; }); return o; });
}
function arcScore(apogee_m, ft) {
  const out = ft < 37 ? 37 - ft : ft > 40 ? ft - 40 : 0;
  return Math.abs(apogee_m * 3.28084 - 800) + 4 * out;
}

/* ---------- run one sweep ---------- */
function sweep(orkPath, rail) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-'));
  const sep = process.platform === 'win32' ? ';' : ':';
  const res = spawnSync('java', ['-Xmx2g', '-Djava.awt.headless=true', '-cp', `${CLS}${sep}${JAR}`, 'FliteTest', orkPath, out, String(rail)],
    { encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 256 * 1024 * 1024 });
  if (res.status !== 0 || !fs.existsSync(path.join(out, 'meta.json'))) {
    const tail = ((res.stderr || '') + (res.stdout || '')).split('\n').filter(l => /Exception|Error|error:|Caused by/.test(l)).slice(0, 6).join(' | ');
    throw new Error('OpenRocket could not simulate this file' + (tail ? ': ' + tail.slice(0, 600) : ` (exit ${res.status}${res.error ? ', ' + res.error.message : ''})`));
  }
  return { meta: JSON.parse(fs.readFileSync(path.join(out, 'meta.json'), 'utf8')), sum: parseCsv(path.join(out, 'summary.csv')), traj: parseCsv(path.join(out, 'trajectories.csv')) };
}

// 0.1 s steps for the first 12 s (boost/coast detail), 1 s after, plus the last sample.
function resample(rows) {
  const keys = ['t', 'x', 'y', 'z', 'vz', 'v', 'stab', 'aoa_deg', 'accel'];
  const o = Object.fromEntries(keys.map(k => [k, []]));
  if (!rows.length) return o;
  const tEnd = rows[rows.length - 1].t;
  const times = [];
  for (let t = 0; t < Math.min(12, tEnd) - 1e-9; t += 0.1) times.push(+t.toFixed(1));
  for (let t = 12; t < tEnd - 1e-9; t += 1) times.push(t);
  times.push(tEnd);
  let j = 0;
  for (const t of times) {
    while (j < rows.length - 2 && rows[j + 1].t < t) j++;
    const a = rows[j], b = rows[Math.min(j + 1, rows.length - 1)];
    const f = b.t > a.t ? Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))) : 0;
    for (const k of keys) {
      if (k === 't') { o.t.push(r(t, 3)); continue; }
      const va = a[k], vb = b[k];
      const val = va === null || vb === null ? (va ?? vb) : va + (vb - va) * f;
      o[k].push(r(val, k === 'stab' ? 3 : 2));
    }
  }
  return o;
}

// Rule checks from the real component tree (FliteTest.java "comps": [type, name, mass_g, x_mm, len_mm, od_mm, id_mm]).
function analyse(meta) {
  const C = (meta.comps || []).map(([type, name, g, x, len, od, id]) => ({ type, name, g, x, len, od, id }));
  const tubes = C.filter(c => c.type === 'BodyTube' && c.od);
  const t80 = tubes.filter(c => c.od >= 65.5 && c.od <= 67 && c.len >= 304.8);
  const other = t80.length ? tubes.filter(c => Math.abs(c.od - t80[0].od) >= 10) : [];
  const eggs = C.filter(c => /egg/i.test(c.name) && !/capsule|foam|bay|bulkhead|holder|protect|cradle/i.test(c.name));
  const eggMass = eggs.reduce((a, c) => a + c.g, 0);
  const alt = C.find(c => /altimeter|jolly ?logic|firefly|altus/i.test(c.name));
  const chutes = C.filter(c => c.type === 'Parachute');
  const streamers = C.filter(c => c.type === 'Streamer');
  const ballast = C.filter(c => c.type === 'MassComponent' && /ballast|nose ?weight|clay/i.test(c.name));
  const buttons = C.filter(c => c.type === 'RailButton' || (c.type === 'LaunchLug' && /rail ?button|button/i.test(c.name)));
  const lugs = C.filter(c => c.type === 'LaunchLug' && !buttons.includes(c));
  const rodLug = lugs.find(c => c.id >= 6.3); // fits a 1/4 in (6.35 mm) rod
  let guide = 'No launch guide modelled', guideOk = false;
  if (buttons.length) { guide = `Rail buttons: ${buttons.map(b => `${b.name} @ ${Math.round(b.x)} mm`).join(', ')}`; guideOk = true; }
  else if (lugs.length) { const l = rodLug || lugs[0]; guide = `Launch lug ${l.name}, ${l.id ?? '?'} mm ID @ ${Math.round(l.x)} mm${rodLug ? '' : ' (too small for a 1/4 in rod)'}`; guideOk = !!rodLug; }
  const fmtIn = mm => (mm / 25.4).toFixed(1);
  return {
    chute: chutes.length ? chutes.map(c => `${Math.round(c.od)} mm (${fmtIn(c.od)} in)`).join(' + ') : streamers.length ? 'Streamer' : 'None modelled',
    ballast: ballast.length ? ballast.map(b => `${b.g.toFixed(1)} g @ ${Math.round(b.x)} mm from tip`).join(', ') : 'None',
    guide,
    checks: {
      t80: t80.length > 0 && other.length > 0,
      t80_text: t80.length ? `T-80 × ${Math.round(t80[0].len)} mm${other.length ? `, 2nd tube ${other[0].od.toFixed(1)} mm` : ', no 2nd tube ≥10 mm different'}` : 'No T-80 (66 mm) tube ≥ 305 mm',
      eggs: eggs.length >= 2,
      altimeter: !!alt,
      eggs_text: `${eggs.length} egg${eggs.length === 1 ? '' : 's'}${eggs.length ? ` (${eggMass.toFixed(0)} g)` : ''} · ${alt ? alt.name : 'no altimeter modelled'}`,
      guide_ok: guideOk,
      chute: chutes.length > 0,
      impulse: meta.impulse_ns,
    },
  };
}

function csvFor(sum) {
  const head = 'run,wind_speed_mps,wind_from_deg,apogee_m,flight_time_s,in_37_40_s_window,arc_score_points,landing_distance_m,land_east_m,land_north_m,apogee_offset_m,max_velocity_mps,max_mach,max_accel_mps2,rail_exit_velocity_mps,time_to_apogee_s,deploy_velocity_mps,ground_hit_velocity_mps,stability_rail_exit_cal';
  return head + '\n' + sum.map(s => [s.run, s.wind.toFixed(3), s.dir, s.apogee.toFixed(2), s.ft.toFixed(3), s.ft >= 37 && s.ft <= 40 ? 'True' : 'False', s.score.toFixed(1),
    s.drift.toFixed(2), s.lx.toFixed(2), s.ly.toFixed(2), s.apo_off.toFixed(2), s.vmax.toFixed(2), s.mach.toFixed(4), s.amax.toFixed(1), s.vrail.toFixed(2), s.tapo.toFixed(3),
    (s.vdep ?? 0).toFixed(2), s.vhit.toFixed(2), s.srail === null ? '' : s.srail.toFixed(4)].join(',')).join('\n') + '\n';
}

function buildVersion(req, res, keys) {
  const { meta, sum, traj } = res;
  const name = (req.name || meta.name || req.filename || 'Imported rocket').trim().slice(0, 80);
  let key = slug(name), n = 2;
  while (keys.has(key)) key = slug(name) + '_' + n++;
  const S = { run: [], wind: [], dir: [], apogee: [], ft: [], score: [], drift: [], lx: [], ly: [], apo_off: [], vmax: [], mach: [], amax: [], vrail: [], tapo: [], vdep: [], vhit: [], srail: [] };
  const rowsOut = [];
  for (const s of sum) {
    const row = { run: s.run, wind: r(s.wind_mps, 4), dir: s.wind_from_deg, apogee: r(s.apogee_m), ft: r(s.flight_time_s), score: r(arcScore(s.apogee_m, s.flight_time_s), 4),
      drift: r(s.drift_m), lx: r(s.land_x_m), ly: r(s.land_y_m), apo_off: r(Math.hypot(s.apogee_x_m, s.apogee_y_m), 4), vmax: r(s.max_vel_mps), mach: r(s.max_mach, 4),
      amax: r(s.max_accel_mps2), vrail: r(s.rod_exit_vel_mps), tapo: r(s.time_to_apogee_s), vdep: r(s.deploy_vel_mps), vhit: r(s.ground_hit_vel_mps), srail: r(s.stability_rod_exit_cal, 4) };
    for (const k in S) S[k].push(row[k]);
    rowsOut.push(row);
  }
  const byRun = {};
  for (const t of traj) (byRun[t.run] ||= []).push(t);
  const T = {};
  for (const run in byRun) T[run] = resample(byRun[run]);
  const a = analyse(meta);
  const base = (req.filename || name + '.ork').replace(/[^\w.\- ()]+/g, '_');
  const stem = base.replace(/\.ork$/i, '');
  const files = { [`${key}/${stem}.ork`]: { mime: 'application/octet-stream', b64: req.ork_b64 }, [`${key}/${stem}_wind_sweep_results.csv`]: { mime: 'text/csv', b64: Buffer.from(csvFor(rowsOut)).toString('base64') } };
  const tarc = a.checks.t80 && a.checks.eggs && a.checks.guide_ok;
  const version = {
    key, name, short: name.length > 22 ? name.slice(0, 21) + '…' : name, date: today(), rail: req.rail, mass: r(meta.mass_g, 1), length: r(meta.length_mm, 0),
    stab: r(meta.stab_cal, 2), cg: r(meta.cg_mm, 1), cp: r(meta.cp_mm, 1), ref: r(meta.ref_mm, 1), motor: meta.motor, impulse: r(meta.impulse_ns, 1),
    chute: a.chute, ballast: a.ballast, guide: a.guide, tarc, checks: a.checks,
    note: (req.note || '').trim().slice(0, 600) || `Imported ${today()}${req.by ? ' by ' + req.by : ''} from ${base}. Swept automatically on GitHub Actions.`,
    imported: true, uploaded_by: req.by || '', summary: S, traj: T, parts: meta.parts, files: Object.keys(files),
  };
  return { version, files };
}

/* ---------- main ---------- */
const P = await decrypt(fs.readFileSync(PAYLOAD));
const D = P.data;
D.log ||= [];
for (const k of ['css', 'html', 'js']) {
  const f = path.join(SRC, 'app', `app.${k}`);
  if (fs.existsSync(f)) P[k] = fs.readFileSync(f, 'utf8');
}
const cfgFile = path.join(SRC, 'config.json');
if (fs.existsSync(cfgFile)) D.site = { ...D.site, ...JSON.parse(fs.readFileSync(cfgFile, 'utf8')) };

const inbox = fs.existsSync(INBOX) ? fs.readdirSync(INBOX).filter(f => f.endsWith('.enc')).sort() : [];
let failures = 0;
for (const f of inbox) {
  const full = path.join(INBOX, f);
  const entry = { time: new Date().toISOString(), file: f, ok: false, msg: '' };
  try {
    const req = await decrypt(fs.readFileSync(full));
    entry.by = req.by || '';
    if (req.type === 'delete') {
      const i = D.versions.findIndex(v => v.key === req.key);
      if (i < 0) throw new Error(`No version "${req.key}"`);
      if (!D.versions[i].imported) throw new Error(`"${D.versions[i].name}" is an original version and cannot be removed from the site`);
      const [v] = D.versions.splice(i, 1);
      for (const name of v.files) delete D.files[name];
      entry.ok = true; entry.msg = `Removed "${v.name}"`;
    } else {
      if (!req.ork_b64) throw new Error('Request has no .ork data');
      const rail = Math.min(5, Math.max(0.5, +req.rail || 1.83));
      req.rail = rail;
      const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ork-')), 'rocket.ork');
      fs.writeFileSync(tmp, Buffer.from(req.ork_b64, 'base64'));
      console.log(`Sweeping ${req.filename || f} (rail ${rail} m)…`);
      const t0 = Date.now();
      const res = sweep(tmp, rail);
      const { version, files } = buildVersion(req, res, new Set(D.versions.map(v => v.key)));
      D.versions.unshift(version);
      Object.assign(D.files, files);
      const calm = res.sum.find(s => s.wind_from_deg === 270 && s.wind_mps === 0) || res.sum[0];
      entry.ok = true; entry.key = version.key;
      entry.msg = `Added "${version.name}": calm ${calm.apogee_m.toFixed(1)} m / ${calm.flight_time_s.toFixed(2)} s, ${version.mass} g, ${version.stab} cal (${((Date.now() - t0) / 1000).toFixed(0)} s)`;
    }
  } catch (e) {
    failures++;
    entry.msg = String(e && e.message || e).replace(/OperationError.*/, 'Could not decrypt (was it encrypted with the current site password?)');
  }
  console.log((entry.ok ? 'OK   ' : 'FAIL ') + f + ': ' + entry.msg);
  D.log.unshift(entry);
  fs.unlinkSync(full);
}
D.log = D.log.slice(0, 60);
D.generated = today();
D.revision = (D.revision || 0) + 1;
fs.writeFileSync(PAYLOAD, await encrypt(P));
console.log(`Wrote payload: ${D.versions.length} versions, ${(fs.statSync(PAYLOAD).size / 1e6).toFixed(2)} MB, revision ${D.revision}${failures ? `, ${failures} failed request(s)` : ''}`);
