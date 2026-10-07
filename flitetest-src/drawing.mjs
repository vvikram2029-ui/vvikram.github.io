// Auto-generated general-arrangement drawing (B-size sheet, SVG, millimetres) from FliteTest.java meta.json.
// Layout follows the hand-made BHS-MK2-002 drawing: front view, end view, fin detail, section with
// item balloons + CG/CP, parts list, flight-performance table, notes, revision block and title block.

const W = 431.8, H = 279.4;                       // ANSI B landscape
const STD = [1, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 12, 1 / 15, 1 / 20];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f1 = x => (x === null || x === undefined || !isFinite(x) ? '—' : (+x).toFixed(1));
const f0 = x => (x === null || x === undefined || !isFinite(x) ? '—' : String(Math.round(x)));
const up = s => esc(String(s ?? '').toUpperCase());
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const scaleFor = fit => STD.find(s => s <= fit) || STD[STD.length - 1];
const scaleTxt = s => (s >= 1 ? '1:1' : `1:${Math.round(1 / s)}`);

function svgText(x, y, t, o = {}) {
  const a = [`x="${x.toFixed(2)}"`, `y="${y.toFixed(2)}"`, `font-size="${o.size || 2.6}"`];
  if (o.anchor) a.push(`text-anchor="${o.anchor}"`);
  if (o.bold) a.push('font-weight="700"');
  if (o.rot) a.push(`transform="rotate(${o.rot} ${x.toFixed(2)} ${y.toFixed(2)})"`);
  return `<text ${a.join(' ')}>${t}</text>`;
}
const line = (x1, y1, x2, y2, cls = '') => `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"${cls ? ` class="${cls}"` : ''}/>`;
const poly = (pts, cls = '', close = true) => `<${close ? 'polygon' : 'polyline'} points="${pts.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ')}"${cls ? ` class="${cls}"` : ''}/>`;
// Horizontal dimension with extension lines from yFrom up/down to yDim.
function hdim(x1, x2, yDim, label, yFrom1, yFrom2 = yFrom1) {
  if (Math.abs(x2 - x1) < 0.5) return '';
  const mid = (x1 + x2) / 2, small = Math.abs(x2 - x1) < 9;
  return line(x1, yFrom1, x1, yDim + (yDim < yFrom1 ? -1.5 : 1.5), 'thin') + line(x2, yFrom2, x2, yDim + (yDim < yFrom2 ? -1.5 : 1.5), 'thin') +
    line(x1, yDim, x2, yDim, 'dim') + svgText(small ? x2 + 1.2 : mid, yDim - 0.9, label, { anchor: small ? 'start' : 'middle', size: 2.4 });
}
function vdim(x, y1, y2, label, side = 1) {
  return line(x, y1, x, y2, 'dim') + svgText(x + side * 1.4, (y1 + y2) / 2, label, { anchor: 'middle', size: 2.4, rot: -90 });
}
function table(x, y, cols, rows, rowH, head) { // cols: [[title, width, align]]
  let s = '', yy = y;
  const total = cols.reduce((a, c) => a + c[1], 0);
  if (head) { s += `<rect x="${x}" y="${yy}" width="${total}" height="${rowH}" class="cell"/>` + svgText(x + total / 2, yy + rowH * 0.72, head, { anchor: 'middle', bold: true, size: 2.5 }); yy += rowH; }
  const all = [cols.map(c => c[0]), ...rows];
  all.forEach((r, ri) => {
    let xx = x;
    cols.forEach((c, ci) => {
      s += `<rect x="${xx.toFixed(2)}" y="${yy.toFixed(2)}" width="${c[1]}" height="${rowH.toFixed(2)}" class="cell"/>`;
      const al = c[2] || 'start', tx = al === 'end' ? xx + c[1] - 1.2 : al === 'middle' ? xx + c[1] / 2 : xx + 1.2;
      s += svgText(tx, yy + rowH * 0.72, r[ci] ?? '', { anchor: al, bold: ri === 0, size: Math.min(2.4, rowH * 0.62) });
      xx += c[1];
    });
    yy += rowH;
  });
  return { svg: s, bottom: yy };
}

export function drawingSvg({ meta, version, calm, dwgNo, org = 'BHS ROCKETRY — ARC 2027' }) {
  const C = (meta.comps || []).map(([type, name, g, x, len, od, id, geo]) => ({ type, name, g, x, len, od, id, geo: geo || {} }));
  const ext = C.filter(c => ['NoseCone', 'Transition', 'BodyTube'].includes(c.type)).sort((a, b) => a.x - b.x);
  const fins = C.filter(c => /FinSet$/.test(c.type) && c.geo.pts);
  const mg = meta.motor_geo;
  const L = Math.max(meta.length_mm, mg ? mg.x + mg.len : 0, ...ext.map(c => c.x + c.len));
  const maxR = Math.max(10, ...ext.map(c => (c.od || 0) / 2));
  const finSpan = Math.max(0, ...fins.map(f => Math.max(...f.geo.pts.map(p => p[1]))));
  const s = scaleFor(Math.min(225 / L, 34 / (maxR + finSpan)));
  const X0 = 22, FY = 78, SY = 162;                  // front-view and section-view centre lines
  const X = x => X0 + x * s;

  // outer radius profile along the body
  const prof = [];
  for (const c of ext) {
    if (c.geo.prof) c.geo.prof.forEach((r, i) => prof.push([c.x + (c.len * i) / 24, r]));
    else prof.push([c.x, c.od / 2], [c.x + c.len, c.od / 2]);
  }
  const bodyEnd = ext.length ? Math.max(...ext.map(c => c.x + c.len)) : L;
  const outline = cy => {
    let o = '';
    if (prof.length) {
      const top = prof.map(([x, r]) => [X(x), cy - r * s]), bot = prof.map(([x, r]) => [X(x), cy + r * s]).reverse();
      o += poly([...top, ...bot], 'body');
      for (const c of ext.slice(1)) { const r = (c.geo.prof ? c.geo.prof[0] : c.od / 2); o += line(X(c.x), cy - r * s, X(c.x), cy + r * s); }
    }
    for (const f of fins) {                       // project each fin onto the view plane
      const n = f.geo.n || 3, br = f.geo.br || maxR;
      for (let i = 0; i < n; i++) {
        const dy = Math.cos((2 * Math.PI * i) / n);
        if (Math.abs(dy) < 0.05) { o += line(X(f.x), cy, X(f.x + Math.max(...f.geo.pts.map(p => p[0]))), cy, 'thin'); continue; }
        const sign = dy > 0 ? -1 : 1;
        o += poly(f.geo.pts.map(([px, py]) => [X(f.x + px), cy + sign * (br + py * Math.abs(dy)) * s]), 'body');
      }
    }
    if (mg && mg.x + mg.len > bodyEnd + 0.5) o += `<rect x="${X(bodyEnd).toFixed(2)}" y="${(cy - (mg.d / 2) * s).toFixed(2)}" width="${((mg.x + mg.len - bodyEnd) * s).toFixed(2)}" height="${(mg.d * s).toFixed(2)}" class="body"/>`;
    o += line(X(-8), cy, X(L) + 8, cy, 'center');
    return o;
  };

  let g = '';
  /* ---------- sheet frame, zones ---------- */
  g += `<rect x="4" y="4" width="${W - 8}" height="${H - 8}" class="thin"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" class="frame"/>`;
  for (let i = 0; i < 8; i++) {
    const x = 10 + ((W - 20) * (i + 0.5)) / 8;
    g += svgText(x, 8.3, 8 - i, { anchor: 'middle', size: 2.6 }) + svgText(x, H - 5.7, 8 - i, { anchor: 'middle', size: 2.6 });
    if (i) { const xe = 10 + ((W - 20) * i) / 8; g += line(xe, 4, xe, 10, 'thin') + line(xe, H - 10, xe, H - 4, 'thin'); }
  }
  'DCBA'.split('').forEach((z, i) => {
    const y = 10 + ((H - 20) * (i + 0.5)) / 4;
    g += svgText(7, y + 1, z, { anchor: 'middle', size: 2.6 }) + svgText(W - 7, y + 1, z, { anchor: 'middle', size: 2.6 });
    if (i) { const ye = 10 + ((H - 20) * i) / 4; g += line(4, ye, 10, ye, 'thin') + line(W - 10, ye, W - 4, ye, 'thin'); }
  });

  /* ---------- revision block ---------- */
  const rev = table(W - 140, 12, [['REV', 10, 'middle'], ['DESCRIPTION', 80], ['DATE', 28, 'middle'], ['APPR', 10, 'middle']],
    [['A', cut('AUTO-GENERATED FROM ' + up(version.filename || 'ORK FILE'), 52), version.date, '—']], 4.2, 'REVISIONS');
  g += rev.svg;

  /* ---------- front view ---------- */
  g += outline(FY);
  const yTop = FY - (maxR + finSpan) * s;
  let chainY = yTop - 6;
  ext.forEach(c => { g += hdim(X(c.x), X(c.x + c.len), chainY, f0(c.len), FY - (c.geo.prof ? Math.max(...c.geo.prof) : c.od / 2) * s - 1); });
  if (fins.length) g += hdim(X(0), X(fins[0].x), chainY - 6, `${f0(fins[0].x)} FIN LE`, FY - 1);
  g += hdim(X(0), X(L), chainY - 12, f0(L), FY - 1, FY - 1);
  const seenD = new Set();
  ext.filter(c => c.type === 'BodyTube').forEach(c => {
    const k = Math.round(c.od * 10); if (seenD.has(k)) return; seenD.add(k);
    const xm = X(c.x + c.len * 0.55); g += vdim(xm, FY - (c.od / 2) * s, FY + (c.od / 2) * s, 'Ø' + f1(c.od), -1);
  });
  const guides = C.filter(c => c.type === 'RailButton' || c.type === 'LaunchLug');
  guides.forEach((c, i) => {
    const r = ext.find(e => c.x >= e.x && c.x <= e.x + e.len), rr = r ? (r.geo.prof ? r.geo.prof[12] : r.od / 2) : maxR;
    const gy = FY + rr * s;
    g += `<rect x="${X(c.x).toFixed(2)}" y="${gy.toFixed(2)}" width="${Math.max(1.5, c.len * s).toFixed(2)}" height="1.4" class="body"/>`;
    g += line(X(c.x + c.len / 2), gy + 1.4, X(c.x) + 14, gy + 6 + i * 4, 'thin') + svgText(X(c.x) + 15, gy + 6.8 + i * 4, cut(up(`${c.name}, STA ${f0(c.x)}–${f0(c.x + c.len)}`), 60), { size: 2.3 });
  });
  g += svgText(X(L / 2), FY + (maxR + finSpan) * s + 14, 'FRONT VIEW', { anchor: 'middle', bold: true, size: 3.4 }) + svgText(X(L / 2), FY + (maxR + finSpan) * s + 18, 'SCALE ' + scaleTxt(s), { anchor: 'middle', size: 2.4 });

  /* ---------- end (right) view ---------- */
  const ex = 287, ey = 70;
  const es = scaleFor(Math.min(1, 22 / (maxR + finSpan)));
  const radii = [...new Set(ext.filter(c => c.type === 'BodyTube').map(c => c.od / 2))].sort((a, b) => b - a);
  radii.forEach(r => { g += `<circle cx="${ex}" cy="${ey}" r="${(r * es).toFixed(2)}" class="body"/>`; });
  const mmt = C.find(c => c.type === 'InnerTube');
  if (mmt) g += `<circle cx="${ex}" cy="${ey}" r="${((mmt.od / 2) * es).toFixed(2)}" class="body"/><circle cx="${ex}" cy="${ey}" r="${((mmt.id / 2) * es).toFixed(2)}" class="thin"/>`;
  for (const f of fins) {
    const n = f.geo.n || 3, br = f.geo.br || maxR, sp = Math.max(...f.geo.pts.map(p => p[1])), t = Math.max(f.geo.t || 3, 1.2 / es);
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), px = -sa * (t / 2) * es, py = ca * (t / 2) * es;
      const p1 = [ex + ca * br * es, ey + sa * br * es], p2 = [ex + ca * (br + sp) * es, ey + sa * (br + sp) * es];
      g += poly([[p1[0] + px, p1[1] + py], [p2[0] + px, p2[1] + py], [p2[0] - px, p2[1] - py], [p1[0] - px, p1[1] - py]], 'body');
    }
    g += svgText(ex - (maxR + sp) * es - 2, ey - (maxR + sp) * es + 2, `${+(360 / n).toFixed(1)}° TYP`, { anchor: 'end', size: 2.3 });
  }
  g += line(ex - 30, ey, ex + 30, ey, 'center') + line(ex, ey - 30, ex, ey + 30, 'center');
  if (mmt) g += line(ex + (mmt.od / 2) * es * 0.7, ey + (mmt.od / 2) * es * 0.7, ex + 16, ey + 24, 'thin') + svgText(ex + 17, ey + 25, `Ø${f0(mg ? mg.d : mmt.id)} MMT`, { size: 2.3 });
  g += svgText(ex, ey + 33, 'RIGHT VIEW', { anchor: 'middle', bold: true, size: 3.4 }) + svgText(ex, ey + 37, 'SCALE ' + scaleTxt(es), { anchor: 'middle', size: 2.4 });

  /* ---------- fin detail ---------- */
  if (fins.length) {
    const f = fins[0], pts = f.geo.pts;
    const chord = Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])), sp = Math.max(...pts.map(p => p[1]));
    const fs = scaleFor(Math.min(80 / chord, 48 / sp));
    const fx = 330, fy = 104;
    g += poly(pts.map(([x, y]) => [fx + x * fs, fy - y * fs]), 'body');
    const root = pts.filter(p => Math.abs(p[1]) < 0.01).map(p => p[0]), rootC = Math.max(...root) - Math.min(...root);
    const tipPts = pts.filter(p => Math.abs(p[1] - sp) < 0.01).map(p => p[0]);
    g += hdim(fx, fx + rootC * fs, fy + 9, f0(rootC), fy + 1);
    if (tipPts.length >= 2) {
      const t0 = Math.min(...tipPts), t1 = Math.max(...tipPts);
      g += hdim(fx, fx + t0 * fs, fy + 4.5, f0(t0), fy + 1, fy - sp * fs + 1);
      g += hdim(fx + t0 * fs, fx + t1 * fs, fy - sp * fs - 5, f0(t1 - t0), fy - sp * fs - 1);
    }
    const xr = fx + Math.max(...pts.map(p => p[0])) * fs + 6;
    g += line(xr - 4, fy, xr + 1.5, fy, 'thin') + line(xr - 4, fy - sp * fs, xr + 1.5, fy - sp * fs, 'thin') + vdim(xr, fy - sp * fs, fy, f0(sp), 1);
    g += svgText(fx, 40, `DETAIL C — FIN`, { bold: true, size: 3.4 }) + svgText(fx, 44, 'SCALE ' + scaleTxt(fs), { size: 2.4 });
    g += svgText(fx + (chord * fs) / 2, fy + 16, up(`${f1(f.geo.t)} THK ${f.geo.mat || ''} — ${f.geo.n || 3} REQD`), { anchor: 'middle', size: 2.4 });
  }

  /* ---------- section A-A: internals, balloons, CG / CP ---------- */
  g += outline(SY);
  const parts = C.filter(c => !['Rocket', 'AxialStage'].includes(c.type));
  const items = parts.map((c, i) => ({ ...c, item: i + 1 }));
  for (const c of items) {
    const r = c.geo.r ?? (c.od ? c.od / 2 : null);
    if (['MassComponent', 'Parachute', 'ShockCord'].includes(c.type) && r)
      g += `<rect x="${X(c.x).toFixed(2)}" y="${(SY - r * s).toFixed(2)}" width="${(c.len * s).toFixed(2)}" height="${(2 * r * s).toFixed(2)}" class="hidden"/>`;
    if (['InnerTube', 'CenteringRing', 'Bulkhead', 'TubeCoupler', 'EngineBlock'].includes(c.type) && c.od) {
      const ro = c.od / 2, ri = (c.id || 0) / 2;
      g += `<rect x="${X(c.x).toFixed(2)}" y="${(SY - ro * s).toFixed(2)}" width="${Math.max(0.6, c.len * s).toFixed(2)}" height="${((ro - ri) * s).toFixed(2)}" class="cut"/>`;
      g += `<rect x="${X(c.x).toFixed(2)}" y="${(SY + ri * s).toFixed(2)}" width="${Math.max(0.6, c.len * s).toFixed(2)}" height="${((ro - ri) * s).toFixed(2)}" class="cut"/>`;
    }
  }
  if (mg) g += `<rect x="${X(mg.x).toFixed(2)}" y="${(SY - (mg.d / 2) * s).toFixed(2)}" width="${(mg.len * s).toFixed(2)}" height="${(mg.d * s).toFixed(2)}" class="body"/>` +
    svgText(X(mg.x + mg.len / 2), SY + 0.9, up(cut(String(meta.motor || '').replace(/^\S+\s/, ''), 12)), { anchor: 'middle', size: 2.1 });
  // balloons: spread along a row above the section, leaders to each item
  const motorItem = { item: items.length + 1, x: mg ? mg.x : L - 40, len: mg ? mg.len : 20, name: 'MOTOR ' + (meta.motor || ''), g: meta.motor_mass_g, geo: {}, type: 'Motor' };
  const balloonList = [...items, ...(mg ? [motorItem] : [])].sort((a, b) => a.x + a.len / 2 - (b.x + b.len / 2));
  const by = SY - (maxR + finSpan) * s - 12, bR = 3;
  let lastX = -1e9;
  const rowX = balloonList.map(c => { const want = X(c.x + c.len / 2); const xx = Math.max(want, lastX + 2 * bR + 1); lastX = xx; return xx; });
  const over = lastX - (X(L) + 10);
  balloonList.forEach((c, i) => {
    const bx = rowX[i] - (over > 0 ? (over * i) / Math.max(1, balloonList.length - 1) : 0);
    const tx = X(c.x + c.len / 2);
    g += line(bx, by + bR, tx, SY - (c.type === 'Motor' ? 0 : 2), 'leader') + `<circle cx="${tx.toFixed(2)}" cy="${(SY - (c.type === 'Motor' ? 0 : 2)).toFixed(2)}" r="0.45" class="dot"/>`;
    g += `<circle cx="${bx.toFixed(2)}" cy="${by.toFixed(2)}" r="${bR}" class="balloon"/>` + svgText(bx, by + 0.9, c.item, { anchor: 'middle', size: 2.5 });
  });
  const cgX = X(meta.cg_mm), cpX = X(meta.cp_mm);
  g += `<circle cx="${cgX.toFixed(2)}" cy="${SY}" r="2.2" class="cgsym"/><path d="M${cgX.toFixed(2)} ${SY - 2.2}A2.2 2.2 0 0 1 ${(cgX + 2.2).toFixed(2)} ${SY}L${cgX.toFixed(2)} ${SY}Z M${cgX.toFixed(2)} ${SY + 2.2}A2.2 2.2 0 0 1 ${(cgX - 2.2).toFixed(2)} ${SY}L${cgX.toFixed(2)} ${SY}Z" class="fill"/>`;
  g += `<circle cx="${cpX.toFixed(2)}" cy="${SY}" r="2.2" class="cgsym"/><circle cx="${cpX.toFixed(2)}" cy="${SY}" r="0.7" class="fill"/>`;
  const yb = SY + (maxR + finSpan) * s;
  g += hdim(X(0), cgX, yb + 6, `${f0(meta.cg_mm)} CG`, SY + 1, SY + 2.5) + hdim(X(0), cpX, yb + 11, `${f0(meta.cp_mm)} CP`, SY + 1, SY + 2.5);
  g += svgText(X(L / 2), yb + 18, 'SECTION A-A', { anchor: 'middle', bold: true, size: 3.4 }) + svgText(X(L / 2), yb + 22, 'SCALE ' + scaleTxt(s) + ' · CG/CP MOTOR LOADED', { anchor: 'middle', size: 2.4 });

  /* ---------- title block ---------- */
  const tbX = W - 196, tbY = H - 52;
  g += `<rect x="${tbX}" y="${tbY}" width="186" height="42" class="frame"/>`;
  g += line(tbX + 50, tbY, tbX + 50, H - 10) + line(tbX + 108, tbY, tbX + 108, H - 10) + line(tbX + 108, tbY + 20, W - 10, tbY + 20) + line(tbX + 108, tbY + 31, W - 10, tbY + 31) + line(tbX + 50, tbY + 31, tbX + 108, tbY + 31);
  [['UNLESS OTHERWISE SPECIFIED:', 0], ['DIMENSIONS ARE IN MILLIMETERS', 1], ['MASS IN GRAMS · SI UNITS', 2], ['STATIONS FROM NOSE TIP (STA 0)', 3], ['INTERPRET PER ASME Y14.5-2018', 4], ['DO NOT SCALE DRAWING', 5], ['THIRD ANGLE PROJECTION', 7]]
    .forEach(([t, i]) => { g += svgText(tbX + 2, tbY + 4 + i * 3.6, t, { size: 2.1 }); });
  const rows = [['DRAWN', up(version.uploaded_by || 'FLITETEST AUTO'), version.date], ['ANALYSIS', 'OPENROCKET 24.12', version.date], ['CHECKED', '', ''], ['ENG APPR', '', '']];
  rows.forEach((r, i) => { const yy = tbY + 4 + i * 5.2; g += svgText(tbX + 52, yy + 2, r[0], { size: 2.1 }) + svgText(tbX + 68, yy + 2, cut(r[1], 18), { size: 2.1 }) + svgText(tbX + 95, yy + 2, r[2], { size: 2.1 }); if (i) g += line(tbX + 50, yy - 1.2, tbX + 108, yy - 1.2, 'thin'); });
  g += svgText(tbX + 52, tbY + 35, 'FINISH', { size: 1.9 }) + svgText(tbX + 52, tbY + 39.5, 'SEE PARTS LIST', { size: 2.2 });
  g += svgText(tbX + 110, tbY + 3.5, 'ORGANIZATION', { size: 1.9 }) + svgText(tbX + 110, tbY + 8.5, esc(org), { bold: true, size: 3 });
  g += svgText(tbX + 110, tbY + 12.5, 'TITLE', { size: 1.9 }) + svgText(tbX + 110, tbY + 16.3, cut(up(version.name), 34) + ' ROCKET ASSY,', { bold: true, size: 2.7 }) + svgText(tbX + 110, tbY + 19.4, 'GENERAL ARRANGEMENT', { bold: true, size: 2.7 });
  g += line(tbX + 120, tbY + 20, tbX + 120, tbY + 31) + line(tbX + 168, tbY + 20, tbX + 168, tbY + 31);
  g += svgText(tbX + 110, tbY + 23, 'SIZE', { size: 1.9 }) + svgText(tbX + 113, tbY + 29.5, 'B', { bold: true, size: 4.5 });
  g += svgText(tbX + 122, tbY + 23, 'DWG NO.', { size: 1.9 }) + svgText(tbX + 122, tbY + 29.5, esc(dwgNo), { bold: true, size: 4 });
  g += svgText(tbX + 170, tbY + 23, 'REV', { size: 1.9 }) + svgText(tbX + 173, tbY + 29.5, 'A', { bold: true, size: 4.5 });
  g += line(tbX + 134, tbY + 31, tbX + 134, H - 10) + line(tbX + 160, tbY + 31, tbX + 160, H - 10);
  g += svgText(tbX + 110, tbY + 34, 'SCALE', { size: 1.9 }) + svgText(tbX + 110, tbY + 39.5, scaleTxt(s), { size: 2.5 });
  g += svgText(tbX + 136, tbY + 34, 'WEIGHT', { size: 1.9 }) + svgText(tbX + 136, tbY + 39.5, f1(meta.mass_g) + ' G', { size: 2.5 });
  g += svgText(tbX + 162, tbY + 34, 'SHEET', { size: 1.9 }) + svgText(tbX + 162, tbY + 39.5, '1 OF 1', { size: 2.5 });

  /* ---------- parts list (above title block, bottom-up like the original) ---------- */
  const plRows = [...items.map(c => [String(c.item), cut(up(c.name), 36), cut(up(c.geo.mat || (c.type === 'MassComponent' ? '—' : '')), 16), String(c.geo.qty || 1), f1(c.g)]),
    ...(mg ? [[String(motorItem.item), cut(up(motorItem.name + ' (LOADED)'), 36), 'COMMERCIAL', '1', f1(meta.motor_mass_g)]] : [])].reverse();
  const plH = Math.min(4.2, (tbY - 120) / (plRows.length + 2));
  const plCols = [['ITEM', 10, 'middle'], ['DESCRIPTION', 80], ['MATERIAL', 34], ['QTY', 10, 'middle'], ['MASS G', 18, 'end']];
  const plX = W - 10 - plCols.reduce((a, c) => a + c[1], 0);
  const plTop = tbY - plH * (plRows.length + 1) - 1;
  g += svgText(plX, plTop - 1.5, `PARTS LIST — TOTAL LIFTOFF MASS ${f1(meta.mass_g)} G`, { bold: true, size: 2.8 });
  let yy = plTop;
  [...plRows, plCols.map(c => c[0])].forEach((r, ri) => { // item rows top-down, header row last (at the bottom)
    let xx = plX;
    plCols.forEach((c, ci) => {
      const al = c[2] || 'start', tx = al === 'end' ? xx + c[1] - 1.2 : al === 'middle' ? xx + c[1] / 2 : xx + 1.2;
      g += `<rect x="${xx.toFixed(2)}" y="${yy.toFixed(2)}" width="${c[1]}" height="${plH.toFixed(2)}" class="cell"/>` + svgText(tx, yy + plH * 0.72, r[ci], { anchor: al, bold: ri === plRows.length, size: Math.min(2.3, plH * 0.6) });
      xx += c[1];
    });
    yy += plH;
  });

  /* ---------- flight performance ---------- */
  const fp = [
    ['APOGEE', calm ? f1(calm.apogee) + ' M' : '—', 'TARGET 243.8 M'],
    ['FLIGHT DURATION', calm ? f1(calm.ft) + ' S' : '—', 'WINDOW 37–40 S'],
    ['LIFTOFF MASS', f1(meta.mass_g) + ' G', '650 G MAX'],
    ['OVERALL LENGTH', f0(meta.length_mm) + ' MM', '650 MM MIN'],
    ['STATIC MARGIN', (+meta.stab_cal).toFixed(2) + ' CAL', '~2 CAL REC.'],
    ['RAIL EXIT VELOCITY', calm ? f1(calm.vrail) + ' M/S' : '—', (+(version.rail || 1.83)).toFixed(2) + ' M RAIL'],
    ['MAX VELOCITY', calm ? `${f1(calm.vmax)} M/S (M ${(+calm.mach).toFixed(2)})` : '—', '—'],
    ['GROUND-HIT VELOCITY', calm ? f1(calm.vhit) + ' M/S' : '—', '—'],
    ['MOTOR', cut(up(meta.motor), 22), meta.impulse_ns ? `${f1(meta.impulse_ns)} N·S (≤ 80)` : '≤ 80 N·S'],
  ];
  const fpt = table(124, H - 62, [['PARAMETER', 36], ['VALUE', 30], ['ARC 2027 LIMIT', 30]], fp, 4.6, 'FLIGHT PERFORMANCE (OPENROCKET 24.12, CALM AIR)');
  g += fpt.svg;

  /* ---------- notes ---------- */
  const notes = ['INTERPRET DRAWING PER ASME Y14.5-2018. ALL DIMENSIONS IN MM; ALL UNITS SI.',
    'AUTO-GENERATED BY FLITETEST FROM THE OPENROCKET FILE. VERIFY BEFORE BUILDING.',
    'STATIONS MEASURED FROM NOSE TIP (STA 0).',
    `CG/CP AT LAUNCH, MOTOR LOADED. STATIC MARGIN ${(+meta.stab_cal).toFixed(2)} CAL (REF Ø${f1(meta.ref_mm)}).`,
    'WEIGH THE AS-BUILT ASSEMBLY AND RE-TUNE BALLAST IN OPENROCKET.',
    'ALL COMPONENTS TETHERED TO THE SHOCK CORD DURING RECOVERY (ARC 2027).',
    'EGGS: RAW, GRADE A LARGE, 55–63 G, ANY ORIENTATION.',
    'MOTOR RETAINED BY POSITIVE MECHANICAL MEANS.'];
  g += svgText(16, H - 60, 'NOTES: UNLESS OTHERWISE SPECIFIED', { bold: true, size: 2.5 });
  notes.forEach((n, i) => { g += svgText(16, H - 54.5 + i * 5.2, `${i + 1}.  ${cut(n, 78)}`, { size: 1.95 }); });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" font-family="DejaVu Sans, Arial, Helvetica, sans-serif">
<style>
  *{fill:none;stroke:#111;stroke-width:.25;stroke-linejoin:round}
  text{fill:#111;stroke:none}
  .frame{stroke-width:.6}.body{stroke-width:.4;fill:#fff}.thin{stroke-width:.15}
  .dim{stroke-width:.15;marker-start:url(#a);marker-end:url(#a)}
  .center{stroke-width:.15;stroke-dasharray:6 1.2 1 1.2}
  .hidden{stroke-width:.2;stroke-dasharray:1.2 .8;fill:none}
  .cut{stroke-width:.2;fill:url(#hatch)}
  .leader{stroke-width:.15}.dot,.fill{fill:#111;stroke:none}
  .balloon{stroke-width:.25;fill:#fff}.cgsym{stroke-width:.3;fill:#fff}.cell{stroke-width:.2;fill:none}
</style>
<defs>
  <marker id="a" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 2L10 5L0 8Z" style="fill:#111;stroke:none"/></marker>
  <pattern id="hatch" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="1.2" style="stroke:#111;stroke-width:.15"/></pattern>
</defs>
<rect x="0" y="0" width="${W}" height="${H}" style="fill:#fff;stroke:none"/>
${g}
</svg>`;
}
