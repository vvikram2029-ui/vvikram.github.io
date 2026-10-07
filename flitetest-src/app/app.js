(function(){
const D = window.__BHS_DATA;
const FT = window.__FT || { timers:[], chat:[] };
const escH = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Imported versions carry text typed by teammates: escape it once, since the views build HTML strings.
D.versions.forEach(v => { if(!v.imported || v._esc) return; v._esc=true;
  for(const k of ['name','short','note','chute','ballast','guide','motor','uploaded_by']) v[k]=escH(v[k]);
  if(v.checks) for(const k of ['t80_text','eggs_text']) v.checks[k]=escH(v.checks[k]);
  v.parts=v.parts.map(p=>[escH(p[0]),...p.slice(1)]); });
const $ = (s, r=document) => r.querySelector(s);
const el = (tag, attrs={}, html='') => { const e=document.createElement(tag); for(const k in attrs){ if(k==='class') e.className=attrs[k]; else e.setAttribute(k,attrs[k]); } if(html) e.innerHTML=html; return e; };
const fmt = (x,n=1) => (x===null||x===undefined||isNaN(x)) ? '—' : Number(x).toFixed(n);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const DIRS = [225,270,315], DIRN = {225:'from SW (225°)',270:'from W (270°)',315:'from NW (315°)'}, DSYM={225:'circle',270:'square',315:'triangle-up'};
const TARGET_M = 243.84;
const TABS = [['overview','Overview'],['design','Design & drawing'],['sweep','Wind sweep'],['profiles','Flight profiles'],['trajectory','Trajectory & landing'],['stability','Stability'],['recovery','Recovery'],['compare','Version compare'],['data','Data table'],['docs','Documents'],['method','Method']];
let cur = D.versions[0], tab = 'overview';
const state = { windIdx: 0, dir: 270, metric: 'apogee', qty: 'z', compareMetric: 'score', sortK: 'wind', sortAsc: true, dataDir: 'all' };

/* ---------- helpers ---------- */
function dircol(d){ return {225:css('--s1'),270:css('--s2'),315:css('--s3')}[d]; }
function vcol(i){ return [css('--s1'),css('--s2'),css('--s3'),css('--s4'),css('--s5'),css('--s6')][i%6]; }
function windRamp(w, wmax=10.3){ const t=Math.max(0,Math.min(1,w/wmax)); const a=[134,182,239], b=[13,54,107]; return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`; }
function rows(v, dir){ const s=v.summary, out=[]; for(let i=0;i<s.run.length;i++){ if(dir!==undefined && dir!=='all' && s.dir[i]!==+dir) continue; const r={}; for(const k in s) r[k]=s[k][i]; out.push(r);} return out; }
function windList(v){ return rows(v,270).map(r=>r.wind); }
function runAt(v, dir, idx){ return rows(v,dir)[idx]; }
function inWin(ft){ return ft>=37 && ft<=40; }
function baseLayout(extra={}){
  return Object.assign({ paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', font:{family:'Inter,system-ui,sans-serif',size:12,color:css('--ink2')},
    margin:{l:60,r:20,t:20,b:50}, hovermode:'closest', legend:{orientation:'h',y:-0.2},
    xaxis:{gridcolor:css('--line'),zerolinecolor:css('--line'),linecolor:css('--muted')}, yaxis:{gridcolor:css('--line'),zerolinecolor:css('--line'),linecolor:css('--muted')} }, extra);
}
function ax(title, more={}){ return Object.assign({title:{text:title}, gridcolor:css('--line'), zerolinecolor:css('--line'), linecolor:css('--muted')}, more); }
const CFG = {responsive:true, displaylogo:false, toImageButtonOptions:{format:'png',scale:2}};
function plot(id, data, layout){ Plotly.react(id, data, baseLayout(layout), CFG); }
function b64ToBlob(b64, mime){ const bin=atob(b64), n=bin.length, u=new Uint8Array(n); for(let i=0;i<n;i++) u[i]=bin.charCodeAt(i); return new Blob([u],{type:mime}); }
const urlCache={};
function fileUrl(name){ if(!urlCache[name]){ const f=D.files[name]; urlCache[name]=URL.createObjectURL(b64ToBlob(f.b64,f.mime)); } return urlCache[name]; }
function download(name){ const a=el('a',{href:fileUrl(name),download:name.split('/').pop()}); document.body.appendChild(a); a.click(); a.remove(); }
function sizeOf(name){ return (D.files[name].b64.length*0.75/1024).toFixed(0)+' KB'; }
function compliance(v){
  const calm = runAt(v,270,0), c = v.checks; // c: explicit checks from the component tree (imported versions)
  return [
    ['Liftoff mass ≤ 650 g', v.mass<=650, fmt(v.mass,1)+' g'],
    ['Overall length ≥ 650 mm', v.length>=650, v.length+' mm'],
    c ? ['T-80 (66 mm) tube ≥ 305 mm + 2nd diameter ≥ 10 mm different', c.t80, c.t80_text]
      : ['T-80 (66 mm) tube ≥ 305 mm + 2nd diameter ≥ 10 mm different', v.tarc!==false && v.ref===66.0, v.ref===66.0?'T-80 × 330 mm, BT-60 step 24.4 mm':'No T-80 tube'],
    ['Motor ≤ 80 N·s, ARC-approved', v.impulse ? v.impulse<=80 : true, v.motor+(v.impulse?` · ${fmt(v.impulse,1)} N·s (confirm it is on the approved list)`:'')],
    c ? ['Two eggs + approved altimeter', c.eggs&&c.altimeter, c.eggs_text]
      : ['Two eggs + approved altimeter', v.ref===66.0, v.ref===66.0?'2 × 60 g eggs, Jolly Logic AltimeterTwo':'Not carried'],
    ['Launch guide fits ≥ 1/4 in rod or 1 in rail', c ? c.guide_ok : !/lug/i.test(v.guide)&&!/rod, 1 m/.test(v.guide), v.guide],
    ['Calm-air flight time in 37–40 s', inWin(calm.ft), fmt(calm.ft,2)+' s'],
    ['Calm-air apogee within Finals window (236.2–251.5 m)', calm.apogee>=236.2&&calm.apogee<=251.5, fmt(calm.apogee,1)+' m'],
    ['Static margin ≥ 1.5 cal (≈2 recommended)', v.stab>=1.5, fmt(v.stab,2)+' cal'],
  ];
}
function windowLimit(v){ const r=rows(v,270); let lim=null; for(const x of r){ if(inWin(x.ft)) lim=x.wind; else if(lim!==null) break; } return lim; }

/* ---------- shell ---------- */
const vpick=$('#vpick');
const unesc = s => { const t=document.createElement('textarea'); t.innerHTML=s; return t.value; };
D.versions.forEach((v,i)=>{ const o=el('option',{value:i}); o.textContent=(v.imported?unesc(v.name):v.name)+(v.imported?` · imported ${v.date}`:''); vpick.appendChild(o); });
{ const i=D.versions.findIndex(v=>v.key===FT.select); if(i>=0){ cur=D.versions[i]; vpick.value=i; } }
vpick.onchange=()=>{ cur=D.versions[+vpick.value]; FT.select=cur.key; state.windIdx=Math.min(state.windIdx, windList(cur).length-1); render(); };
$('#foot').textContent=`Simulated with OpenRocket 24.12 (RK4, Barrowman). 123 runs per version: wind 0–10.3 m/s in 0.257 m/s steps from 225°, 270°, 315°, 10% turbulence. ${D.versions.length} versions · updated ${D.generated}.`;
const tabsEl=$('#tabs');
TABS.forEach(([k,l])=>{ const b=el('button',{class:'tab','data-k':k}); b.textContent=l; b.onclick=()=>{ tab=k; location.hash=k; render(); }; tabsEl.appendChild(b); });
if(location.hash && TABS.some(t=>t[0]===location.hash.slice(1))) tab=location.hash.slice(1);
$('#themeBtn').onclick=()=>{ const r=document.documentElement; const dark = r.dataset.theme ? r.dataset.theme==='dark' : matchMedia('(prefers-color-scheme: dark)').matches; r.dataset.theme = dark?'light':'dark'; render(); };
$('#lockBtn').onclick=()=>{ location.reload(); };
$('#lightbox').onclick=()=>$('#lightbox').classList.remove('on');

function render(){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on', b.dataset.k===tab));
  document.querySelectorAll('main > section').forEach(s=>{ s.style.display = s.dataset.tab===tab ? '' : 'none'; });
  const sec = document.querySelector(`section[data-tab="${tab}"]`);
  ({overview,design,sweep,profiles,trajectory,stability,recovery,compare,data,docs,method})[tab](sec);
}
function head(sec, title, sub, right=''){ sec.innerHTML = `<div class="sec-title"><div><h2>${title}</h2><p>${sub}</p></div><div>${right}</div></div>`; }
function windSlider(sec, onchange){
  const ws=windList(cur);
  const wrap=el('div',{class:'controls'});
  wrap.innerHTML=`<div class="ctl">Wind speed <input type="range" min="0" max="${ws.length-1}" step="1" value="${state.windIdx}" id="wslider"> <b id="wval">${fmt(ws[state.windIdx],2)} m/s</b> <span class="pill" id="wkt">${fmt(ws[state.windIdx]/0.514444,1)} kt</span></div>
  <div class="ctl">Direction <select id="wdir">${DIRS.map(d=>`<option value="${d}" ${d===state.dir?'selected':''}>${DIRN[d]}</option>`).join('')}</select></div>`;
  sec.appendChild(wrap);
  const s=$('#wslider',wrap), d=$('#wdir',wrap);
  s.oninput=()=>{ state.windIdx=+s.value; $('#wval',wrap).textContent=fmt(ws[state.windIdx],2)+' m/s'; $('#wkt',wrap).textContent=fmt(ws[state.windIdx]/0.514444,1)+' kt'; onchange(); };
  d.onchange=()=>{ state.dir=+d.value; onchange(); };
}
function kpis(container, items){ container.innerHTML = items.map(([k,v,d])=>`<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d||''}</div></div>`).join(''); }

/* ---------- OVERVIEW ---------- */
function overview(sec){
  const calm=runAt(cur,270,0), lim=windowLimit(cur);
  head(sec, cur.name, cur.note);
  const k=el('div',{class:'grid g4'}); sec.appendChild(k);
  kpis(k,[
    ['Apogee (calm)', fmt(calm.apogee,1)+' m', `target 243.8 m · off by ${fmt(Math.abs(calm.apogee-TARGET_M),1)} m`],
    ['Flight time (calm)', fmt(calm.ft,2)+' s', inWin(calm.ft)?'<span class="ok">inside 37–40 s window</span>':'<span class="bad">outside 37–40 s window</span>'],
    ['ARC score (calm)', fmt(calm.score,1), 'points · lower is better'],
    ['Stays in time window to', lim===null?'never':fmt(lim,2)+' m/s', lim===null?'<span class="bad">not inside at any wind</span>':`≈ ${fmt(lim/0.514444,1)} kt wind`],
    ['Liftoff mass', fmt(cur.mass,1)+' g', cur.mass<=650?'<span class="ok">≤ 650 g limit</span>':'<span class="bad">over 650 g limit</span>'],
    ['Static margin', fmt(cur.stab,2)+' cal', `CG ${fmt(cur.cg,0)} mm · CP ${fmt(cur.cp,0)} mm`],
    ['Rail exit velocity', fmt(calm.vrail,1)+' m/s', `${cur.rail} m rail`],
    ['Landing speed (calm)', fmt(calm.vhit,1)+' m/s', `chute ${cur.chute}`],
  ]);
  const g=el('div',{class:'grid g2',style:'margin-top:16px'}); sec.appendChild(g);
  const c1=el('div',{class:'card'}); c1.innerHTML='<h3>ARC 2027 compliance</h3><p class="sub">Checked against the 2027 rules and this version\'s simulation</p>';
  const t=el('table'); t.innerHTML='<tr><th>Requirement</th><th>Status</th><th>Value</th></tr>'+compliance(cur).map(([a,ok,v])=>`<tr><td>${a}</td><td class="${ok?'ok':'bad'}"><span class="status">${ok?'✓ Pass':'✗ Fail'}</span></td><td>${v}</td></tr>`).join('');
  c1.appendChild(t); g.appendChild(c1);
  const c2=el('div',{class:'card'}); c2.innerHTML='<h3>Score vs wind speed</h3><p class="sub">Predicted ARC flight score, wind from the west. Hover for values.</p><div id="ovScore" class="plot short"></div>'; g.appendChild(c2);
  const c3=el('div',{class:'card',style:'margin-top:16px'}); c3.innerHTML=`<h3>Configuration</h3><table>
   <tr><td>Motor</td><td>${cur.motor}</td></tr><tr><td>Parachute</td><td>${cur.chute}</td></tr><tr><td>Nose ballast</td><td>${cur.ballast}</td></tr>
   <tr><td>Launch guide</td><td>${cur.guide}</td></tr><tr><td>Length</td><td>${cur.length} mm</td></tr><tr><td>Reference diameter</td><td>${cur.ref} mm</td></tr><tr><td>File date</td><td>${cur.date}</td></tr></table>`;
  sec.appendChild(c3);
  const r=rows(cur,270);
  plot('ovScore',[{x:r.map(x=>x.wind),y:r.map(x=>x.score),mode:'lines+markers',line:{color:css('--s1'),width:2},marker:{size:6},name:'score',
    hovertemplate:'%{x:.2f} m/s → %{y:.1f} pts<extra></extra>'}], {xaxis:ax('Wind speed (m/s)'),yaxis:ax('Score (points)'),showlegend:false,margin:{l:55,r:10,t:10,b:45}});
}

/* ---------- DESIGN ---------- */
function design(sec){
  head(sec,'Design & engineering drawing','General arrangement, parts list and mass breakdown for '+cur.name+'.');
  const g=el('div',{class:'grid g2'}); sec.appendChild(g);
  const c1=el('div',{class:'card'});
  if(cur.drawing_img){ c1.innerHTML='<h3>Engineering drawing</h3><p class="sub">Click to open full size. PDF in Documents.</p>'; const im=el('img',{class:'drawing',src:fileUrl(cur.drawing_img),alt:'Engineering drawing of '+cur.name}); im.onclick=()=>{ $('#lbimg').src=im.src; $('#lightbox').classList.add('on'); }; c1.appendChild(im); }
  else { const dv=D.versions.filter(v=>v.drawing_img); c1.innerHTML=`<h3>Engineering drawing</h3><p class="note">No formal drawing was produced for this version.${dv.length?' Drawings exist for: '+dv.map(v=>v.short).join(', ')+'.':''}</p><div id="profileSvg"></div>`; }
  g.appendChild(c1);
  const c2=el('div',{class:'card'}); c2.innerHTML='<h3>Mass breakdown</h3><p class="sub">Component masses from OpenRocket (hover for values)</p><div id="massPlot" class="plot"></div>'; g.appendChild(c2);
  const parts=cur.parts.filter(p=>!p[0].startsWith('MOTOR')); const mot=cur.parts.find(p=>p[0].startsWith('MOTOR'));
  const items=parts.map(p=>({n:p[0],m:+p[1],x:+p[2],l:+p[3]})); if(mot) items.push({n:'Motor '+mot[0].replace('MOTOR ',''),m:+mot[1],x:null,l:null});
  items.sort((a,b)=>a.m-b.m);
  plot('massPlot',[{type:'bar',orientation:'h',x:items.map(i=>i.m),y:items.map(i=>i.n),marker:{color:css('--s1')},hovertemplate:'%{y}: %{x:.1f} g<extra></extra>'}],
    {xaxis:ax('Mass (g)'),yaxis:{automargin:true,gridcolor:'rgba(0,0,0,0)'},margin:{l:10,r:20,t:10,b:45},showlegend:false});
  const c3=el('div',{class:'card',style:'margin-top:16px'}); c3.innerHTML='<h3>Parts list</h3>';
  const tw=el('div',{class:'tablewrap',style:'max-height:none'}); const t=el('table');
  t.innerHTML='<tr><th>Component</th><th class="num">Mass (g)</th><th class="num">Station (mm from tip)</th><th class="num">Length (mm)</th></tr>'+
    items.slice().sort((a,b)=>(a.x??9e9)-(b.x??9e9)).map(i=>`<tr><td>${i.n}</td><td class="num">${fmt(i.m,1)}</td><td class="num">${i.x===null?'—':fmt(i.x,0)}</td><td class="num">${i.l===null?'—':fmt(i.l,0)}</td></tr>`).join('')+
    `<tr><td><b>Total liftoff mass</b></td><td class="num"><b>${fmt(items.reduce((a,b)=>a+b.m,0),1)}</b></td><td></td><td></td></tr>`;
  tw.appendChild(t); c3.appendChild(tw); sec.appendChild(c3);
}

/* ---------- WIND SWEEP ---------- */
const METRICS = {
  apogee:{l:'Apogee (m AGL)',band:[236.2,251.5],line:TARGET_M,lt:'243.8 m target · Finals window shaded'},
  ft:{l:'Total flight time (s)',band:[37,40],lt:'ARC window 37–40 s'},
  score:{l:'ARC score (points, lower is better)'},
  drift:{l:'Landing distance from pad (m)'},
  apo_off:{l:'Apogee horizontal offset (m)'},
  vhit:{l:'Ground-hit velocity (m/s)',line:6.1,lt:'6.1 m/s typical safe-landing limit'},
  vdep:{l:'Velocity at chute deployment (m/s)'},
  vmax:{l:'Maximum velocity (m/s)'},
  amax:{l:'Maximum acceleration (m/s²)'},
  tapo:{l:'Time to apogee (s)'},
  srail:{l:'Stability margin at rail exit (cal)',line:2,lt:'≈2 cal ARC recommendation'},
  vrail:{l:'Rail exit velocity (m/s)',line:13.7,lt:'13.7 m/s common minimum'},
};
function refShapes(m, xmax){
  const sh=[], an=[]; const M=METRICS[m];
  if(M.band) sh.push({type:'rect',xref:'paper',x0:0,x1:1,y0:M.band[0],y1:M.band[1],fillcolor:css('--good'),opacity:.10,line:{width:0},layer:'below'});
  if(M.line!==undefined) sh.push({type:'line',xref:'paper',x0:0,x1:1,y0:M.line,y1:M.line,line:{color:css('--warn'),width:1.5,dash:'dash'}});
  if(M.lt) an.push({xref:'paper',x:1,y:M.line!==undefined?M.line:M.band[1],text:M.lt,showarrow:false,xanchor:'right',yanchor:'bottom',font:{size:11,color:css('--ink2')}});
  return {shapes:sh,annotations:an};
}
function sweep(sec){
  head(sec,'Wind sweep','All 123 simulations for this version: wind 0–10.3 m/s from SW, W and NW. Pick any measured quantity; hover a point for the run’s numbers.');
  const c=el('div',{class:'controls'}); c.innerHTML=`<div class="ctl">Quantity <select id="mSel">${Object.entries(METRICS).map(([k,v])=>`<option value="${k}" ${k===state.metric?'selected':''}>${v.l}</option>`).join('')}</select></div>
   <div class="ctl"><label><input type="checkbox" id="allV"> overlay every version (wind from W)</label></div>`;
  sec.appendChild(c);
  const card=el('div',{class:'card'}); card.innerHTML='<div id="sweepPlot" class="plot tall"></div>'; sec.appendChild(card);
  const draw=()=>{
    const m=state.metric, all=$('#allV').checked; let tr=[];
    if(all){ D.versions.forEach((v,i)=>{ const r=rows(v,270); tr.push({x:r.map(x=>x.wind),y:r.map(x=>x[m]),name:v.short,mode:'lines+markers',marker:{size:5},line:{width:v===cur?3:1.6,color:vcol(i)},hovertemplate:v.short+'<br>%{x:.2f} m/s → %{y:.2f}<extra></extra>'}); }); }
    else { DIRS.forEach(d=>{ const r=rows(cur,d); tr.push({x:r.map(x=>x.wind),y:r.map(x=>x[m]),name:DIRN[d],mode:'lines+markers',marker:{size:6,symbol:DSYM[d]},line:{width:1.8,color:dircol(d)},
      customdata:r.map(x=>[x.run,x.apogee,x.ft,x.score,x.drift]),hovertemplate:'Run %{customdata[0]} · %{x:.2f} m/s<br>value %{y:.2f}<br>apogee %{customdata[1]:.1f} m · %{customdata[2]:.2f} s<br>score %{customdata[3]:.1f} · lands %{customdata[4]:.1f} m out<extra>'+DIRN[d]+'</extra>'}); }); }
    const ref=refShapes(m);
    plot('sweepPlot',tr,{xaxis:ax('Wind speed (m/s)'),yaxis:ax(METRICS[m].l),shapes:ref.shapes,annotations:ref.annotations,legend:{orientation:'h',y:-0.15}});
  };
  $('#mSel').onchange=e=>{ state.metric=e.target.value; draw(); }; $('#allV').onchange=draw; draw();
}

/* ---------- FLIGHT PROFILES ---------- */
const QTY = {z:['Altitude (m AGL)',1], v:['Total velocity (m/s)',1], vz:['Vertical velocity (m/s)',1], accel:['Acceleration (m/s²)',1], stab:['Stability margin (cal)',1], aoa_deg:['Angle of attack (°)',1], x:['East–west position (m)',1]};
function profiles(sec){
  head(sec,'Flight profiles','Time histories for every run. Drag the wind slider to step through all 41 wind speeds; the selected flight is highlighted over the rest.');
  const q=el('div',{class:'controls'}); q.innerHTML=`<div class="ctl">Quantity <select id="qSel">${Object.entries(QTY).map(([k,v])=>`<option value="${k}" ${k===state.qty?'selected':''}>${v[0]}</option>`).join('')}</select></div>
   <div class="ctl">Time range <select id="tSel"><option value="all">whole flight</option><option value="15">first 15 s</option><option value="5">first 5 s</option></select></div>`;
  sec.appendChild(q);
  windSlider(sec, ()=>draw());
  const k=el('div',{class:'grid g4'}); sec.appendChild(k);
  const card=el('div',{class:'card',style:'margin-top:16px'}); card.innerHTML='<div id="profPlot" class="plot tall"></div>'; sec.appendChild(card);
  const draw=()=>{
    const r=rows(cur,state.dir), sel=r[state.windIdx], tmax=$('#tSel').value==='all'?1e9:+$('#tSel').value, qk=state.qty;
    const tr=[];
    r.forEach((x,i)=>{ if(i===state.windIdx) return; const T=cur.traj[x.run]; const idx=T.t.map((t,j)=>t<=tmax?j:-1).filter(j=>j>=0);
      tr.push({x:idx.map(j=>T.t[j]),y:idx.map(j=>T[qk][j]),mode:'lines',line:{width:1,color:windRamp(x.wind)},opacity:.35,hoverinfo:'skip',showlegend:false}); });
    const T=cur.traj[sel.run]; const idx=T.t.map((t,j)=>t<=tmax?j:-1).filter(j=>j>=0);
    tr.push({x:idx.map(j=>T.t[j]),y:idx.map(j=>T[qk][j]),mode:'lines',line:{width:3.5,color:css('--s2')},name:`${fmt(sel.wind,2)} m/s`,hovertemplate:'t %{x:.2f} s<br>%{y:.2f}<extra>selected run</extra>'});
    plot('profPlot',tr,{xaxis:ax('Time (s)'),yaxis:ax(QTY[qk][0]),showlegend:false,shapes:qk==='stab'?[{type:'line',xref:'paper',x0:0,x1:1,y0:2,y1:2,line:{color:css('--warn'),dash:'dash'}}]:[]});
    kpis(k,[['Apogee',fmt(sel.apogee,1)+' m',`time to apogee ${fmt(sel.tapo,2)} s`],['Flight time',fmt(sel.ft,2)+' s',inWin(sel.ft)?'<span class="ok">in window</span>':'<span class="bad">outside window</span>'],
      ['Max velocity',fmt(sel.vmax,1)+' m/s',`Mach ${fmt(sel.mach,3)}`],['ARC score',fmt(sel.score,1),'points']]);
  };
  $('#qSel').onchange=e=>{ state.qty=e.target.value; draw(); }; $('#tSel').onchange=draw; draw();
}

/* ---------- TRAJECTORY & LANDING ---------- */
function trajectory(sec){
  head(sec,'Trajectory & landing','3D flight paths for every run, the landing dispersion map, and the side view. Rotate and zoom the 3D view; the slider highlights one flight.');
  windSlider(sec, ()=>draw());
  const g=el('div',{class:'grid g2'}); sec.appendChild(g);
  g.innerHTML='<div class="card"><h3>3D flight paths</h3><p class="sub">East (x), north (y), altitude (z) in metres. Colour = wind speed.</p><div id="t3d" class="plot tall"></div></div><div class="card"><h3>Landing dispersion</h3><p class="sub">Where each run lands relative to the pad. Hover for details.</p><div id="tdisp" class="plot tall"></div></div>';
  const c=el('div',{class:'card',style:'margin-top:16px'}); c.innerHTML='<h3>Side view: altitude vs downrange</h3><div id="tside" class="plot"></div>'; sec.appendChild(c);
  const draw=()=>{
    const all=rows(cur,'all'), sel=runAt(cur,state.dir,state.windIdx), tr=[];
    all.forEach(x=>{ const T=cur.traj[x.run]; const hl=x.run===sel.run; if(!hl && x.dir!==state.dir) return;
      tr.push({type:'scatter3d',mode:'lines',x:T.x,y:T.y,z:T.z,line:{width:hl?7:2,color:hl?css('--s2'):windRamp(x.wind)},opacity:hl?1:.5,name:hl?'selected':'',showlegend:false,hovertemplate:hl?'x %{x:.1f} m<br>y %{y:.1f} m<br>z %{z:.1f} m<extra>selected</extra>':'<extra></extra>',hoverinfo:hl?undefined:'skip'}); });
    tr.push({type:'scatter3d',mode:'markers',x:[0],y:[0],z:[0],marker:{size:5,color:css('--ink')},name:'Pad',hovertemplate:'Pad<extra></extra>',showlegend:false});
    Plotly.react('t3d',tr,baseLayout({margin:{l:0,r:0,t:0,b:0},scene:{xaxis:{title:'East (m)',gridcolor:css('--line'),color:css('--ink2')},yaxis:{title:'North (m)',gridcolor:css('--line'),color:css('--ink2')},zaxis:{title:'Alt (m)',gridcolor:css('--line'),color:css('--ink2')},aspectmode:'manual',aspectratio:{x:1,y:1,z:1.1}}}),CFG);
    const dt=DIRS.map(d=>{ const r=rows(cur,d); return {x:r.map(x=>x.lx),y:r.map(x=>x.ly),mode:'markers',name:DIRN[d],marker:{size:9,symbol:DSYM[d],color:r.map(x=>x.wind),colorscale:[[0,'#86b6ef'],[.5,'#2a78d6'],[1,'#0d366b']],cmin:0,cmax:10.3,line:{width:1,color:css('--card')},showscale:d===225,colorbar:{title:{text:'m/s'},thickness:12}},
      customdata:r.map(x=>[x.wind,x.drift,x.run]),hovertemplate:'Run %{customdata[2]} · %{customdata[0]:.2f} m/s<br>%{customdata[1]:.1f} m from pad<extra>'+DIRN[d]+'</extra>'}; });
    dt.push({x:[sel.lx],y:[sel.ly],mode:'markers',marker:{size:18,color:'rgba(0,0,0,0)',line:{width:2.5,color:css('--s2')}},name:'selected',hoverinfo:'skip'});
    dt.push({x:[0],y:[0],mode:'markers+text',marker:{size:14,symbol:'star',color:css('--ink')},text:['Pad'],textposition:'top right',name:'Pad',hoverinfo:'skip'});
    const ext=Math.max(...all.map(x=>Math.max(Math.abs(x.lx),Math.abs(x.ly))))*1.15+2;
    plot('tdisp',dt,{xaxis:ax('East of pad (m)',{range:[-ext,ext],scaleanchor:'y'}),yaxis:ax('North of pad (m)',{range:[-ext,ext]}),legend:{orientation:'h',y:-0.15}});
    const side=[]; rows(cur,state.dir).forEach((x,i)=>{ const T=cur.traj[x.run]; const dr=T.x.map((v,j)=>Math.hypot(v,T.y[j])); const hl=i===state.windIdx;
      side.push({x:dr,y:T.z,mode:'lines',line:{width:hl?3.5:1,color:hl?css('--s2'):windRamp(x.wind)},opacity:hl?1:.45,hoverinfo:hl?undefined:'skip',hovertemplate:'%{x:.1f} m out, %{y:.1f} m up<extra>selected</extra>',showlegend:false}); });
    plot('tside',side,{xaxis:ax('Horizontal distance from pad (m)'),yaxis:ax('Altitude (m AGL)')});
  };
  draw();
}

/* ---------- STABILITY ---------- */
function stability(sec){
  head(sec,'Stability','Static margin from the design screen and how it behaves in flight. ARC recommends about 2 calibers.');
  const k=el('div',{class:'grid g4'}); sec.appendChild(k);
  kpis(k,[['Static margin',fmt(cur.stab,2)+' cal','design screen, Mach 0.3'],['Centre of gravity',fmt(cur.cg,0)+' mm','from nose tip, motor loaded'],['Centre of pressure',fmt(cur.cp,0)+' mm','from nose tip'],['Reference diameter',fmt(cur.ref,1)+' mm',`CG→CP ${fmt(cur.cp-cur.cg,0)} mm`]]);
  const svgCard=el('div',{class:'card',style:'margin-top:16px'}); svgCard.innerHTML='<h3>CG / CP layout</h3><p class="sub">To scale along the body length</p>'+cgcpSvg(); sec.appendChild(svgCard);
  windSlider(sec, ()=>draw());
  const g=el('div',{class:'grid g2'}); sec.appendChild(g);
  g.innerHTML='<div class="card"><h3>Margin through boost and coast</h3><div id="sTime" class="plot"></div></div><div class="card"><h3>Margin at rail exit vs wind</h3><div id="sRail" class="plot"></div></div>';
  const draw=()=>{
    const r=rows(cur,state.dir), tr=[];
    r.forEach((x,i)=>{ const T=cur.traj[x.run]; const hl=i===state.windIdx; const idx=T.t.map((t,j)=>t<=x.tapo?j:-1).filter(j=>j>=0);
      tr.push({x:idx.map(j=>T.t[j]),y:idx.map(j=>T.stab[j]),mode:'lines',line:{width:hl?3.5:1,color:hl?css('--s2'):windRamp(x.wind)},opacity:hl?1:.4,showlegend:false,hoverinfo:hl?undefined:'skip',hovertemplate:'t %{x:.2f} s · %{y:.2f} cal<extra>selected</extra>'}); });
    plot('sTime',tr,{xaxis:ax('Time (s)'),yaxis:ax('Stability margin (cal)'),shapes:[{type:'line',xref:'paper',x0:0,x1:1,y0:2,y1:2,line:{color:css('--warn'),dash:'dash'}}]});
    const t2=DIRS.map(d=>{ const rr=rows(cur,d); return {x:rr.map(x=>x.wind),y:rr.map(x=>x.srail),name:DIRN[d],mode:'lines+markers',marker:{size:5,symbol:DSYM[d]},line:{color:dircol(d)},hovertemplate:'%{x:.2f} m/s → %{y:.2f} cal<extra>'+DIRN[d]+'</extra>'}; });
    plot('sRail',t2,{xaxis:ax('Wind speed (m/s)'),yaxis:ax('Stability at rail exit (cal)'),shapes:[{type:'line',xref:'paper',x0:0,x1:1,y0:2,y1:2,line:{color:css('--warn'),dash:'dash'}}]});
  };
  draw();
}
function cgcpSvg(){
  const L=cur.length, W=1000, s=W/L, y=60, h=Math.max(16,cur.ref*s*1.4);
  const cg=cur.cg*s, cp=cur.cp*s;
  return `<svg class="cgcp" viewBox="-20 0 ${W+40} 130" role="img" aria-label="CG and CP positions">
   <path d="M0 ${y} Q ${W*0.12} ${y-h/2} ${W*0.2} ${y-h/2} L ${W*0.98} ${y-h/2} L ${W} ${y-h/2} L ${W} ${y+h/2} L ${W*0.2} ${y+h/2} Q ${W*0.12} ${y+h/2} 0 ${y} Z" fill="none" stroke="${css('--ink2')}" stroke-width="1.5"/>
   <line x1="${cg}" y1="${y-h}" x2="${cg}" y2="${y+h}" stroke="${css('--s2')}" stroke-width="2"/><circle cx="${cg}" cy="${y}" r="7" fill="${css('--s2')}"/>
   <text x="${cg}" y="${y-h-6}" text-anchor="middle" font-size="13" fill="${css('--ink')}">CG ${fmt(cur.cg,0)} mm</text>
   <line x1="${cp}" y1="${y-h}" x2="${cp}" y2="${y+h}" stroke="${css('--s1')}" stroke-width="2"/><circle cx="${cp}" cy="${y}" r="7" fill="none" stroke="${css('--s1')}" stroke-width="3"/>
   <text x="${cp}" y="${y+h+18}" text-anchor="middle" font-size="13" fill="${css('--ink')}">CP ${fmt(cur.cp,0)} mm</text>
   <text x="${(cg+cp)/2}" y="${y+5}" text-anchor="middle" font-size="12" fill="${css('--ink2')}">${fmt(cur.stab,2)} cal</text>
   <text x="0" y="125" font-size="11" fill="${css('--muted')}">nose tip</text><text x="${W}" y="125" font-size="11" text-anchor="end" fill="${css('--muted')}">${L} mm</text></svg>`;
}

/* ---------- RECOVERY ---------- */
function recovery(sec){
  head(sec,'Recovery','Chute deployment and landing. Deployment speed is set by the 8 s ejection delay; landing speed includes horizontal wind.');
  windSlider(sec, ()=>draw());
  const k=el('div',{class:'grid g4'}); sec.appendChild(k);
  const g=el('div',{class:'grid g2',style:'margin-top:16px'}); sec.appendChild(g);
  g.innerHTML='<div class="card"><h3>Deployment and landing speeds vs wind</h3><div id="rv" class="plot"></div></div><div class="card"><h3>Descent (vertical velocity) for the selected run</h3><div id="rd" class="plot"></div></div>';
  const draw=()=>{
    const sel=runAt(cur,state.dir,state.windIdx), T=cur.traj[sel.run];
    const desc=T.vz.filter((v,j)=>T.t[j]>sel.tapo+4 && v!==null); const dr=desc.length?-desc.reduce((a,b)=>a+b,0)/desc.length:NaN;
    kpis(k,[['Deployment velocity',sel.vdep>0?fmt(sel.vdep,1)+' m/s':'no deploy',''],['Descent rate',fmt(dr,1)+' m/s','average under chute'],['Ground-hit velocity',fmt(sel.vhit,1)+' m/s',sel.vhit<=6.1?'<span class="ok">≤ 6.1 m/s</span>':'<span class="warn">above 6.1 m/s guideline</span>'],['Landing distance',fmt(sel.drift,1)+' m','from pad']]);
    const r=rows(cur,state.dir);
    plot('rv',[{x:r.map(x=>x.wind),y:r.map(x=>x.vdep),name:'at deployment',mode:'lines+markers',line:{color:css('--s1')},marker:{size:5}},{x:r.map(x=>x.wind),y:r.map(x=>x.vhit),name:'at ground hit',mode:'lines+markers',line:{color:css('--s2')},marker:{size:5}},
      {x:[sel.wind,sel.wind],y:[sel.vdep,sel.vhit],mode:'markers',marker:{size:14,color:'rgba(0,0,0,0)',line:{width:2.5,color:css('--ink')}},showlegend:false,hoverinfo:'skip'}],
      {xaxis:ax('Wind speed (m/s)'),yaxis:ax('Velocity (m/s)'),shapes:[{type:'line',xref:'paper',x0:0,x1:1,y0:6.1,y1:6.1,line:{color:css('--warn'),dash:'dash'}}],legend:{orientation:'h',y:-0.2}});
    plot('rd',[{x:T.t,y:T.vz,mode:'lines',line:{color:css('--s2'),width:2.5},hovertemplate:'t %{x:.1f} s · %{y:.2f} m/s<extra></extra>'}],{xaxis:ax('Time (s)'),yaxis:ax('Vertical velocity (m/s)'),showlegend:false,
      shapes:[{type:'line',x0:sel.tapo,x1:sel.tapo,yref:'paper',y0:0,y1:1,line:{color:css('--muted'),dash:'dot'}}],annotations:[{x:sel.tapo,yref:'paper',y:1,text:'apogee',showarrow:false,yanchor:'bottom',font:{size:11}}]});
  };
  draw();
}

/* ---------- COMPARE ---------- */
function compare(sec){
  head(sec,'Version compare','Every rocket version tested in this project, side by side (wind from the west).');
  const pts=[0,10,20,40];
  const c=el('div',{class:'card'}); const tw=el('div',{class:'tablewrap',style:'max-height:none'}); const t=el('table');
  t.innerHTML='<tr><th>Version</th><th class="num">Mass g</th><th class="num">Margin cal</th><th class="num">Apogee calm m</th><th class="num">Time calm s</th>'+pts.map(i=>`<th class="num">Score @ ${fmt(windList(D.versions[0])[i],1)} m/s</th>`).join('')+'<th class="num">In window to</th><th>ARC checks</th></tr>'+
    D.versions.map(v=>{ const r=rows(v,270), comp=compliance(v), nPass=comp.filter(x=>x[1]).length, lim=windowLimit(v);
      return `<tr ${v===cur?'style="font-weight:600"':''}><td>${v.name}</td><td class="num">${fmt(v.mass,1)}</td><td class="num">${fmt(v.stab,2)}</td><td class="num">${fmt(r[0].apogee,1)}</td><td class="num ${inWin(r[0].ft)?'ok':'bad'}">${fmt(r[0].ft,2)}</td>`+
      pts.map(i=>`<td class="num">${fmt(r[i].score,1)}</td>`).join('')+`<td class="num">${lim===null?'—':fmt(lim,2)+' m/s'}</td><td class="${nPass===comp.length?'ok':'bad'}">${nPass}/${comp.length}</td></tr>`; }).join('');
  tw.appendChild(t); c.appendChild(tw); sec.appendChild(c);
  const q=el('div',{class:'controls',style:'margin-top:16px'}); q.innerHTML=`<div class="ctl">Quantity <select id="cSel">${Object.entries(METRICS).map(([k,v])=>`<option value="${k}" ${k===state.compareMetric?'selected':''}>${v.l}</option>`).join('')}</select></div>`; sec.appendChild(q);
  const pc=el('div',{class:'card'}); pc.innerHTML='<div id="cmpPlot" class="plot tall"></div>'; sec.appendChild(pc);
  const draw=()=>{ const m=state.compareMetric; const tr=D.versions.map((v,i)=>{ const r=rows(v,270); return {x:r.map(x=>x.wind),y:r.map(x=>x[m]),name:v.short,mode:'lines+markers',marker:{size:5},line:{width:v===cur?3.5:1.6,color:vcol(i)},hovertemplate:v.short+'<br>%{x:.2f} m/s → %{y:.2f}<extra></extra>'}; });
    const ref=refShapes(m); plot('cmpPlot',tr,{xaxis:ax('Wind speed (m/s)'),yaxis:ax(METRICS[m].l),shapes:ref.shapes,annotations:ref.annotations,legend:{orientation:'h',y:-0.15}}); };
  $('#cSel').onchange=e=>{ state.compareMetric=e.target.value; draw(); }; draw();
}

/* ---------- DATA TABLE ---------- */
const COLS=[['run','Run',0],['wind','Wind m/s',2],['dir','From °',0],['apogee','Apogee m',1],['ft','Time s',2],['score','Score',1],['drift','Lands m',1],['lx','East m',1],['ly','North m',1],['vmax','Vmax m/s',1],['vrail','Rail m/s',1],['tapo','T apo s',2],['vdep','Deploy m/s',1],['vhit','Hit m/s',1],['srail','Margin cal',2]];
function data(sec){
  head(sec,'Data table','Every run for this version. Click a column header to sort; filter by direction; export the full CSV.');
  const c=el('div',{class:'controls'}); c.innerHTML=`<div class="ctl">Direction <select id="dSel"><option value="all">all</option>${DIRS.map(d=>`<option value="${d}" ${state.dataDir==d?'selected':''}>${DIRN[d]}</option>`).join('')}</select></div>
    <div class="ctl"><label><input type="checkbox" id="winOnly"> only runs inside 37–40 s</label></div><button class="btn primary" id="csvBtn">Download CSV</button>`;
  sec.appendChild(c);
  const tw=el('div',{class:'tablewrap'}); sec.appendChild(tw);
  const draw=()=>{ let r=rows(cur,state.dataDir); if($('#winOnly').checked) r=r.filter(x=>inWin(x.ft));
    r.sort((a,b)=>(a[state.sortK]-b[state.sortK])*(state.sortAsc?1:-1));
    tw.innerHTML='<table><tr>'+COLS.map(([k,l])=>`<th class="sort num" data-k="${k}">${l}${state.sortK===k?(state.sortAsc?' ▲':' ▼'):''}</th>`).join('')+'</tr>'+
      r.map(x=>'<tr>'+COLS.map(([k,l,n])=>`<td class="num ${k==='ft'?(inWin(x.ft)?'ok':'bad'):''}">${fmt(x[k],n)}</td>`).join('')+'</tr>').join('')+'</table>';
    tw.querySelectorAll('th.sort').forEach(th=>th.onclick=()=>{ const k=th.dataset.k; if(state.sortK===k) state.sortAsc=!state.sortAsc; else {state.sortK=k; state.sortAsc=true;} draw(); }); };
  $('#dSel').onchange=e=>{ state.dataDir=e.target.value; draw(); }; $('#winOnly').onchange=draw;
  $('#csvBtn').onclick=()=>{ const f=cur.files.find(n=>n.endsWith('.csv')); download(f); };
  draw();
}

/* ---------- DOCUMENTS ---------- */
function docs(sec){
  head(sec,'Documents','Every file produced in this project: OpenRocket design files, results spreadsheets, plot reports and engineering drawings. PDFs open in a new tab.');
  const g=el('div',{class:'grid g2'}); sec.appendChild(g);
  D.versions.forEach(v=>{ const c=el('div',{class:'card'}); c.innerHTML=`<h3>${v.name}</h3><p class="sub">${v.date} · ${v.motor}</p>`; const l=el('div',{class:'doclist'});
    v.files.filter(f=>!f.endsWith('.jpg')).forEach(f=>{ const d=el('div',{class:'doc'}); const ext=f.split('.').pop().toUpperCase();
      const kind = f.endsWith('.ork')?'OpenRocket design':f.endsWith('.csv')?'All 123 runs (CSV)':/drawing/.test(f)?'Engineering drawing':'Plot report (21 plots)';
      d.innerHTML=`<div><div class="n">${f.split('/').pop()}</div><div class="m">${kind} · ${ext} · ${sizeOf(f)}</div></div><div class="acts">${ext==='PDF'?'<button class="btn" data-a="open">Open</button>':''}<button class="btn" data-a="dl">Download</button></div>`;
      d.querySelector('[data-a="dl"]').onclick=()=>download(f); const o=d.querySelector('[data-a="open"]'); if(o) o.onclick=()=>window.open(fileUrl(f),'_blank');
      l.appendChild(d); }); c.appendChild(l); g.appendChild(c); });
}

/* ---------- METHOD ---------- */
function method(sec){
  head(sec,'Method','How every test on this site was run, step by step.');
  const c=el('div',{class:'card'}); c.innerHTML=`<div class="steps">
   <div class="step"><div><b>Load the design.</b> Each .ork file is opened with the OpenRocket 24.12 simulation engine (RK4 integrator, Barrowman aerodynamics). The motor is matched from OpenRocket's database.</div></div>
   <div class="step"><div><b>Set the launch site.</b> Brunswick, OH: 41.2381° N, 81.8418° W, 350 m elevation, standard atmosphere. Rail: ${cur.rail} m (6 ft, the ARC qualification minimum, for the TARC versions).</div></div>
   <div class="step"><div><b>Sweep the wind.</b> 41 average wind speeds from 0 to 10.3 m/s (0–20 kt in 0.5 kt steps), each from three directions (225°, 270°, 315°), 10% turbulence intensity: 123 flights per version.</div></div>
   <div class="step"><div><b>Record each flight.</b> Apogee, time to apogee, total flight time, rail-exit velocity and stability, max velocity/acceleration, deployment and ground-hit velocity, landing position, and the full time history.</div></div>
   <div class="step"><div><b>Score it.</b> ARC 2027 scoring: |altitude − 800 ft| + 4 × seconds outside the 37–40 s window (rules score in feet; shown here in SI otherwise).</div></div>
   <div class="step"><div><b>Check the rules.</b> 650 g max liftoff mass, 650 mm min length, T-80 tube ≥ 12 in plus a second diameter, ≤ 80 N·s approved motor, two eggs + approved altimeter, parachute with all parts tethered, ≥ 1/4 in rod or rail (Finals: 1 in rail).</div></div>
  </div><p class="note" style="margin-top:14px">Simulation results are predictions. Weigh the as-built rocket, enter real masses in OpenRocket, and confirm with test flights and altimeter data. Sources: rocketrychallenge.org — 2027 Rules, 2027 Team Handbook v27.1, ARC 2027 Parameters, 2027 Approved Motors List.</p>`;
  sec.appendChild(c);
}

/* =====================================================================
   LIVE UPDATES · IMPORT (.ork → GitHub Action sweep) · AI CHAT
   ===================================================================== */
const REPO='yoda-3x3/yoda-3x3.github.io', API='https://api.github.com/repos/'+REPO;
const ls = { get:k=>{ try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } }, set:(k,v)=>{ try{ v?localStorage.setItem(k,v):localStorage.removeItem(k); }catch(e){} } };
const workerUrl = () => (ls.get('ft_worker') || (D.site&&D.site.worker_url) || '').replace(/\/+$/,'');
const ghToken = () => ls.get('ft_gh_token');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const ago = iso => { const s=(Date.now()-new Date(iso))/1000; return s<90?Math.round(s)+' s ago':s<5400?Math.round(s/60)+' min ago':s<129600?Math.round(s/3600)+' h ago':new Date(iso).toLocaleDateString(); };
function b64(bytes){ let s=''; for(let i=0;i<bytes.length;i+=0x8000) s+=String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000)); return btoa(s); }

// Same format as payload.bin: salt16 | iv12 | AES-256-GCM(gzip(JSON)), key = PBKDF2-SHA256(password, 310k).
async function encryptObj(obj){
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const base=await crypto.subtle.importKey('raw', new TextEncoder().encode(FT.pw), 'PBKDF2', false, ['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:310000, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt']);
  const gz=new Uint8Array(await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, gz));
  const out=new Uint8Array(28+ct.length); out.set(salt,0); out.set(iv,16); out.set(ct,28); return out;
}
// What the worker checks (its AUTH_HASH secret); derived from the site password so nobody has to share another secret.
let authHash=null;
async function workerAuth(){
  if(authHash) return authHash;
  const base=await crypto.subtle.importKey('raw', new TextEncoder().encode(FT.pw), 'PBKDF2', false, ['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2', salt:new TextEncoder().encode('flitetest-worker-v1'), iterations:100000, hash:'SHA-256'}, base, 256);
  return authHash=[...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function workerPost(path, body){
  const r=await fetch(workerUrl()+path, {method:'POST', headers:{'content-type':'application/json','x-ft-auth':await workerAuth()}, body:JSON.stringify(body||{})});
  const d=await r.json().catch(()=>({error:'Bad response from worker ('+r.status+')'}));
  if(!r.ok || d.error) throw new Error(d.error||('Worker error '+r.status));
  return d;
}
async function gh(path, init={}){
  const t=ghToken(); const h={Accept:'application/vnd.github+json'}; if(t) h.Authorization='Bearer '+t;
  const r=await fetch(API+path, {...init, headers:{...h, ...(init.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(r.status===403&&!t ? 'GitHub rate limit reached on this network. Try again in a few minutes.' : 'GitHub '+r.status+': '+(d.message||'request failed'));
  return d;
}
async function latestRuns(){
  if(!ghToken() && workerUrl()) { try { return (await workerPost('/runs')).workflow_runs; } catch(e){ /* fall through to public API */ } }
  return (await gh('/actions/workflows/flitetest.yml/runs?per_page=5')).workflow_runs || [];
}

/* ---------- "new data" banner (another teammate imported something) ---------- */
const banner=$('#banner');
let busy=false;
function showBanner(html){ banner.innerHTML=html; banner.hidden=false; }
async function checkForUpdate(){
  if(busy || !FT.remoteTag || !FT.tag || document.hidden) return;
  try{ const t=await FT.remoteTag(); if(t && t!==FT.tag){ showBanner('New results were published to flitetest. <button class="btn" id="bannerGo">Load them</button>'); $('#bannerGo').onclick=liveReload; } }catch(e){}
}
async function liveReload(){
  showBanner('Loading the new data…');
  try{ await FT.reload(); }catch(e){ showBanner('Could not load the new data ('+escH(e.message)+'). <button class="btn" onclick="location.reload()">Reload page</button>'); }
}
FT.timers.push(setInterval(checkForUpdate, 120000));
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) checkForUpdate(); });

/* ---------- import dialog ---------- */
const dlg=$('#importDlg'); let file=null;
$('#importBtn').onclick=()=>{ refreshDialog(); dlg.showModal(); };
dlg.querySelector('[data-close]').onclick=()=>dlg.close();
dlg.addEventListener('click', e=>{ if(e.target===dlg) dlg.close(); });
function routeText(){ return ghToken() ? 'Upload: your GitHub token' : workerUrl() ? 'Upload: flitetest worker' : 'No upload route set up: you will get a file to upload on GitHub (see Connection settings)'; }
function refreshDialog(){
  $('#impBy').value=ls.get('ft_by'); $('#setWorker').value=ls.get('ft_worker')||(D.site&&D.site.worker_url)||''; $('#setToken').value=ghToken();
  $('#impRoute').textContent=routeText();
  const log=D.log||[];
  $('#impLog').innerHTML = log.length ? '<div class="loglist">'+log.slice(0,25).map(x=>`<div class="logi"><time>${escH(new Date(x.time).toLocaleString())}</time><span class="${x.ok?'ok':'bad'}">${x.ok?'✓':'✗'}</span> ${escH(x.msg)}${x.by?` <span class="tag">${escH(x.by)}</span>`:''}</div>`).join('')+'</div>' : '<p class="sub">Nothing imported yet.</p>';
  const imp=D.versions.filter(v=>v.imported);
  $('#delPick').innerHTML = imp.length ? imp.map(v=>`<option value="${escH(v.key)}">${v.name} (${v.date})</option>`).join('') : '<option value="">No imported versions</option>';
  $('#delGo').disabled=!imp.length;
}
function pickFile(f){
  if(!f) return;
  if(!/\.ork$/i.test(f.name)){ $('#dropTxt').innerHTML='<span class="bad">That is not an .ork file.</span> Choose an OpenRocket .ork'; file=null; $('#impGo').disabled=true; return; }
  if(f.size>25e6){ $('#dropTxt').innerHTML='<span class="bad">File is larger than 25 MB.</span>'; file=null; $('#impGo').disabled=true; return; }
  file=f; $('#dropTxt').innerHTML=`<b>${escH(f.name)}</b> · ${(f.size/1024).toFixed(0)} KB <span class="sub">(click to change)</span>`;
  if(!$('#impName').value) $('#impName').value=f.name.replace(/\.ork$/i,'').replace(/[_]+/g,' ');
  $('#impGo').disabled=false;
}
$('#orkFile').onchange=e=>pickFile(e.target.files[0]);
const drop=$('#drop');
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e=>pickFile(e.dataTransfer.files[0]));
$('#setSave').onclick=()=>{ ls.set('ft_worker',$('#setWorker').value.trim()); ls.set('ft_gh_token',$('#setToken').value.trim()); $('#setMsg').textContent='Saved in this browser.'; $('#impRoute').textContent=routeText(); updateChatHint(); };
$('#hashCopy').onclick=async()=>{ const h=await workerAuth(); try{ await navigator.clipboard.writeText(h); $('#setMsg').textContent='Copied. Paste it as the worker\'s AUTH_HASH secret.'; }catch(e){ $('#setMsg').textContent=h; } };

const STEPS=['Encrypt in this browser','Upload to GitHub','Run the 123-flight sweep','Publish to the site'];
function prog(i, state, det=''){
  const ol=$('#impProg'); ol.hidden=false;
  if(!ol.children.length) ol.innerHTML=STEPS.map(s=>`<li>${s}<span class="det"></span></li>`).join('');
  [...ol.children].forEach((li,j)=>{ li.className = j<i?'done':j===i?state:''; if(j===i) li.querySelector('.det').innerHTML=det; });
}
async function submitRequest(req, label){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const name=`${stamp}_${(label||'rocket').replace(/[^\w-]+/g,'_').slice(0,40)}.${req.type}.enc`;
  prog(0,'now'); const enc=await encryptObj(req); const content=b64(enc);
  prog(1,'now', routeText().replace('Upload: ','via '));
  const since=Date.now()-60000;
  if(ghToken()) await gh('/contents/flitetest-src/inbox/'+name, {method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify({message:'flitetest: queue '+name, content, branch:'main'})});
  else if(workerUrl()) await workerPost('/upload', {name, content_b64:content});
  else {
    const a=el('a',{href:URL.createObjectURL(new Blob([enc],{type:'application/octet-stream'})),download:name}); document.body.appendChild(a); a.click(); a.remove();
    prog(1,'now', `Downloaded <b>${escH(name)}</b>. <a href="https://github.com/${REPO}/upload/main/flitetest-src/inbox" target="_blank" rel="noopener">Upload it here on GitHub</a> (needs write access), then keep this window open.`);
  }
  await trackBuild(since);
}
async function trackBuild(since){
  let run=null; const t0=Date.now();
  while(Date.now()-t0 < 45*60000){
    await sleep(run?8000:5000);
    let runs; try{ runs=await latestRuns(); }catch(e){ prog(2,'now','Waiting for GitHub… ('+escH(e.message)+')'); continue; }
    const r=runs.find(x=>new Date(x.created_at).getTime()>=since);
    if(!r){ if(run===null) continue; } else run=r;
    if(!run) continue;
    if(prog.step!==2){ prog.step=2; }
    const link=` · <a href="${run.html_url}" target="_blank" rel="noopener">view log</a>`;
    if(run.status!=='completed'){ prog(2,'now', `${run.status==='queued'?'Queued':'Running'} · ${Math.round((Date.now()-new Date(run.created_at))/1000)} s${link}`); continue; }
    if(run.conclusion!=='success'){ prog(2,'fail', `The GitHub Action ${escH(run.conclusion)}${link}`); return false; }
    prog(3,'now','Waiting for GitHub Pages to serve the new data…');
    const t1=Date.now();
    while(Date.now()-t1 < 6*60000){
      await sleep(6000);
      try{ const t=await FT.remoteTag(); if(t && t!==FT.tag){ prog(4,'done'); await sleep(400); dlg.close(); busy=false; await liveReload(); return true; } }catch(e){}
    }
    prog(3,'fail','The sweep finished but the site has not updated yet. Reload the page in a minute.'); return false;
  }
  prog(2,'fail','Timed out waiting for the GitHub Action.'); return false;
}
$('#impGo').onclick=async()=>{
  if(!file) return;
  const by=$('#impBy').value.trim(); ls.set('ft_by',by);
  const req={type:'ork', name:$('#impName').value.trim()||file.name.replace(/\.ork$/i,''), note:$('#impNote').value.trim(), rail:+$('#impRail').value||1.83, filename:file.name, by,
    ork_b64:b64(new Uint8Array(await file.arrayBuffer()))};
  busy=true; $('#impGo').disabled=true; $('#impProg').innerHTML='';
  FT.select = null; // after reload the newest version (this import) is first
  try{ await submitRequest(req, req.name); }
  catch(e){ const ol=$('#impProg'); const i=[...ol.children].findIndex(li=>li.classList.contains('now')); prog(Math.max(0,i),'fail',escH(e.message)); }
  finally{ busy=false; $('#impGo').disabled=!file; }
};
$('#delGo').onclick=async()=>{
  const key=$('#delPick').value; const v=D.versions.find(x=>x.key===key); if(!v) return;
  if(!confirm(`Remove "${unesc(v.name)}" from flitetest for everyone?`)) return;
  busy=true; $('#delGo').disabled=true; $('#impProg').innerHTML='';
  if(FT.select===key) FT.select=null;
  try{ await submitRequest({type:'delete', key, by:ls.get('ft_by')}, 'remove_'+key); }
  catch(e){ prog(1,'fail',escH(e.message)); }
  finally{ busy=false; $('#delGo').disabled=false; }
};

/* ---------- AI chat ---------- */
const chat=$('#chat'), logEl=$('#chatLog'), ta=$('#chatText');
const TABNAME=Object.fromEntries(TABS);
$('#chatBtn').onclick=()=>{ chat.hidden=!chat.hidden; if(!chat.hidden){ drawChat(); ta.focus(); } };
$('#chatClose').onclick=()=>{ chat.hidden=true; };
$('#chatClear').onclick=()=>{ FT.chat.length=0; drawChat(); };
function md(s){ // tiny, safe markdown: escape first, then **bold**, `code`, lists, paragraphs
  const lines=escH(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').split('\n');
  let html='', list=null;
  for(const l of lines){
    const m=l.match(/^\s*(?:[-*•]|(\d+)[.)])\s+(.*)/);
    if(m){ const t=m[1]?'ol':'ul'; if(list!==t){ if(list) html+=`</${list}>`; html+=`<${t}>`; list=t; } html+=`<li>${m[2]}</li>`; continue; }
    if(list){ html+=`</${list}>`; list=null; }
    if(l.trim()) html+=`<p>${l.replace(/^#+\s*/,'')}</p>`;
  }
  return html+(list?`</${list}>`:'');
}
function updateChatHint(){ $('#chatModel').textContent = workerUrl() ? (FT.chatModel?'model: '+FT.chatModel:'answers from the data on this site') : 'not connected yet'; }
function drawChat(){
  updateChatHint();
  if(!workerUrl()){ logEl.innerHTML=`<div class="msg bot"><p>The AI assistant runs on a free Cloudflare worker that isn't connected yet.</p><p>Setup steps are in <code>flitetest-src/worker/README.md</code> in the GitHub repo. Once it's deployed, put its URL in <b>Import .ork → Connection settings</b> (or in <code>flitetest-src/config.json</code> for everyone).</p></div>`; return; }
  if(!FT.chat.length){ logEl.innerHTML=`<div class="msg bot"><p>Hi! I can see every version's wind sweep, rule checks and parts list. You're looking at <b>${cur.name}</b>.</p></div><div class="chips">${
    ['Is this version ARC-legal?','How do I get closer to 800 ft?','Why does flight time drop in wind?','Which version is best for a windy day?','How much ballast would I need to remove to gain 10 m?']
    .map(q=>`<button type="button">${q}</button>`).join('')}</div>`;
    logEl.querySelectorAll('.chips button').forEach(b=>b.onclick=()=>{ ta.value=b.textContent; send(); }); return; }
  logEl.innerHTML=FT.chat.map(m=>m.role==='user'?`<div class="msg user">${escH(m.content)}</div>`:m.role==='error'?`<div class="msg err">${escH(m.content)}</div>`:`<div class="msg bot">${md(m.content)}</div>`).join('');
  logEl.scrollTop=logEl.scrollHeight;
}
function chatContext(){
  const r2=x=>x===null||x===undefined?null:Math.round(x*100)/100;
  const versions=D.versions.map(v=>{ const calm=runAt(v,270,0), comp=compliance(v);
    return {key:v.key, name:unesc(v.name), date:v.date, imported:!!v.imported, mass_g:v.mass, length_mm:v.length, static_margin_cal:v.stab, cg_mm:v.cg, cp_mm:v.cp, ref_diameter_mm:v.ref,
      motor:unesc(v.motor), chute:unesc(v.chute), ballast:unesc(v.ballast), launch_guide:unesc(v.guide), rail_m:v.rail,
      calm:{apogee_m:r2(calm.apogee), apogee_ft:r2(calm.apogee*3.28084), flight_time_s:r2(calm.ft), score:r2(calm.score), rail_exit_mps:r2(calm.vrail), ground_hit_mps:r2(calm.vhit), deploy_mps:r2(calm.vdep)},
      stays_in_37_40s_window_to_wind_mps:windowLimit(v), failed_rule_checks:comp.filter(x=>!x[1]).map(x=>x[0]+' ('+String(x[2]).replace(/<[^>]+>/g,'')+')'), note:unesc(v.note)}; });
  const cols=['wind','apogee','ft','score','drift','vhit','vdep','srail'];
  const sweepOf=(d,step)=>rows(cur,d).filter((_,i)=>i%step===0).map(x=>cols.map(k=>r2(x[k])));
  return JSON.stringify({ user_is_viewing:{tab:TABNAME[tab], version:cur.key}, versions,
    selected_version:{key:cur.key, name:unesc(cur.name), parts_g_station_mm_length_mm:cur.parts.map(p=>[unesc(p[0]),+p[1],p[2]===null?null:+p[2],p[3]===null?null:+p[3]]),
      sweep_columns:'wind_mps, apogee_m, flight_time_s, arc_score, landing_distance_m, ground_hit_mps, deploy_mps, rail_exit_margin_cal',
      sweep_from_W_270:sweepOf(270,1), sweep_from_SW_225_every_2nd:sweepOf(225,2), sweep_from_NW_315_every_2nd:sweepOf(315,2)} });
}
async function send(){
  const q=ta.value.trim(); if(!q || !workerUrl()) return;
  ta.value=''; FT.chat.push({role:'user', content:q}); drawChat();
  const typing=el('div',{class:'msg bot typing'},'Thinking…'); logEl.appendChild(typing); logEl.scrollTop=logEl.scrollHeight;
  $('#chatSend').disabled=true;
  try{
    const d=await workerPost('/chat', {messages:FT.chat.filter(m=>m.role!=='error'), context:chatContext()});
    FT.chat.push({role:'assistant', content:d.reply}); FT.chatModel=d.model;
  }catch(e){ FT.chat.push({role:'error', content:'Could not get an answer: '+e.message}); }
  finally{ $('#chatSend').disabled=false; drawChat(); ta.focus(); }
}
$('#chatForm').onsubmit=e=>{ e.preventDefault(); send(); };
ta.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } });
/* ---------- top bar: clock, launch-site weather, fun fact, ticker ---------- */
const clockEl=$('#tbClock');
const tickClock=()=>{ clockEl.textContent=new Date().toLocaleString([], {weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', second:'2-digit'}); };
tickClock(); FT.timers.push(setInterval(tickClock, 1000));

const WMO={0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Fog',51:'Drizzle',53:'Drizzle',55:'Drizzle',56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Showers',81:'Showers',82:'Heavy showers',85:'Snow showers',86:'Snow showers',95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'};
const compass=d=>['N','NE','E','SE','S','SW','W','NW'][Math.round(((d%360)+360)%360/45)%8];
async function weather(){
  try{
    const s=D.site||{lat:41.2381,lon:-81.8418};
    const d=await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms`)).json();
    const c=d.current, w=c.wind_speed_10m;
    $('#tbWx').innerHTML=`Brunswick ${fmt(c.temperature_2m,0)} °C · ${WMO[c.weather_code]||'—'} · wind ${fmt(w,1)} m/s from ${compass(c.wind_direction_10m)}, gusts ${fmt(c.wind_gusts_10m,1)}`+
      (w<=4.5?' <span class="ok">· launch-friendly</span>':w<=9?' <span class="warn">· breezy</span>':' <span class="bad">· too windy</span>');
  }catch(e){ $('#tbWx').textContent='Weather unavailable'; }
}
const FACTS=['A model rocket on an F motor can pass 60 m/s in under two seconds.','The first liquid-fuelled rocket, launched by Robert Goddard in 1926, flew for 2.5 seconds and reached 12.5 m.','Rocket Lab names its Electron launches with jokes, like "It\'s Business Time".','Barrowman\'s stability equations, used by OpenRocket, came from a 1967 NASA master\'s thesis.','Saturn V\'s first stage burned about 12.9 tonnes of propellant per second.','An egg is strongest along its long axis: it is much harder to crush end-to-end than side-to-side.','Octopuses have three hearts.','Honey found in Egyptian tombs was still edible after 3,000 years.','Venus spins so slowly that a day there is longer than its year.'];
let factBusy=false;
async function funFact(){
  if(factBusy) return; factBusy=true;
  let t='';
  try{ const r=await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en'); t=(await r.json()).text||''; }catch(e){}
  if(!t || t.length>260) t=FACTS[Math.floor(Math.random()*FACTS.length)];
  const b=$('#tbFact'); b.innerHTML='<b>Fun fact:</b> '+escH(t.trim()); b.title=t.trim()+'\n(click for another)'; factBusy=false;
}
$('#tbFact').onclick=funFact;

const LEAGUES=[['football','nfl','NFL'],['basketball','nba','NBA'],['baseball','mlb','MLB'],['hockey','nhl','NHL'],['football','college-football','NCAAF']];
async function sports(){
  const out=[];
  await Promise.all(LEAGUES.map(async([sp,lg,label])=>{
    try{
      const d=await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sp}/${lg}/scoreboard`)).json();
      (d.events||[]).slice(0, lg==='college-football'?8:12).forEach(e=>{
        const c=e.competitions&&e.competitions[0]; if(!c) return;
        const away=c.competitors.find(t=>t.homeAway==='away'), home=c.competitors.find(t=>t.homeAway==='home'); if(!away||!home) return;
        const st=e.status.type, A=away.team.abbreviation, H=home.team.abbreviation;
        const txt = st.state==='pre' ? `${A} @ ${H} <span class="k">${escH(st.shortDetail)}</span>`
          : `${A} ${away.score} – ${H} ${home.score} ${st.state==='in'?`<span class="live">● ${escH(st.shortDetail)}</span>`:`<span class="k">${escH(st.shortDetail)}</span>`}`;
        out.push({lg:label, order:st.state==='in'?0:st.state==='post'?1:2, html:txt});
      });
    }catch(e){}
  }));
  return out.sort((a,b)=>a.order-b.order);
}
async function ticker(){
  const [sp, wk]=await Promise.all([sports(), workerUrl()?fetch(workerUrl()+'/ticker').then(r=>r.json()).catch(()=>null):Promise.resolve(null)]);
  const tk=(k,body)=>`<span class="tk"><span class="k">${k}</span>${body}</span>`;
  const stocks = wk&&wk.stocks&&wk.stocks.length
    ? wk.stocks.map(s=>{ const up=s.c>=0; return tk(escH(s.s), (s.p>=1000?s.p.toLocaleString(undefined,{maximumFractionDigits:0}):fmt(s.p,2))+(s.c===null?'':` <span class="${up?'up':'dn'}">${up?'▲':'▼'} ${fmt(Math.abs(s.c),2)}%</span>`)); })
    : [tk('Markets', workerUrl()?'unavailable right now':'connect the flitetest worker for live stocks + world news')];
  const scores = sp.map(s=>tk(s.lg, s.html));
  const news = (wk&&wk.news||[]).map(n=>tk('World', `<a href="${escH(n.u)}" target="_blank" rel="noopener">${escH(n.t)}</a>`));
  // Interleave so stocks, scores and headlines alternate instead of arriving in long blocks.
  const mix=[];
  for(let i=0;i<Math.max(stocks.length,scores.length,news.length);i++) [stocks[i],scores[i],news[i]].forEach(h=>h&&mix.push(h));
  const track=$('#tkTrack'); track.innerHTML=mix.join('')+mix.join(''); // doubled for a seamless loop
  requestAnimationFrame(()=>track.style.setProperty('--dur', Math.max(40, track.scrollWidth/2/60)+'s')); // ~60 px/s
}
weather(); funFact(); ticker();
FT.timers.push(setInterval(weather, 10*60000), setInterval(ticker, 5*60000), setInterval(funFact, 3*60000));

if(FT.chatOpen){ chat.hidden=false; drawChat(); }
FT.timers.push(setInterval(()=>{ FT.chatOpen=!chat.hidden; }, 1000));
banner.hidden=true;

render();
})();
