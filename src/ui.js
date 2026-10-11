import * as THREE from 'three';
import { P, buildQuant, clamp, estStr, fmtDate, fmtHour, fmtHourM, gr, nat, nf, sg } from './geo.js';
import { setObraQ, CENARIOS, CONTEXTO, GRAN, GRP, MANUAL, MARSHALL, OBRA, PROCTOR, USINA, deflStats, gauss, rng } from './data.js';
import { setExag, stateAt, surfC, wx, wy } from './scene.js';
import {
  camAt,
  setQ,
  setCEN,
  resetTerrKey,
  setCamAnim,
  CEN,
  END,
  LAY,
  Q,
  ST,
  SVC,
  TT,
  applyTheme,
  buildMarkers,
  buildPavement,
  camAnim,
  camera,
  controls,
  frontPoint,
  initScene,
  labels,
  liftExtents,
  lr,
  rebuild,
  renderer,
  root,
  scene,
  setProfileClip,
  setView,
  updateEquipment,
  updateMarkers,
  updatePavement,
  updateSite,
  updateTerrain
} from './app.js';
import { DECISOES, GAME, briefing, finishGame, gameGate, lsGet, lsSet, resetGame, setMode, tabMissao, updateHud } from './game.js';

// ==INTERFACE==
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const svcById = id => SVC.find(s => s.id === id);
const pct = v => Math.round(v * 100) + ' %';

// liberações de camada (BLC)
const GATES = [
  { id: 'BLC-A', nome: 'Aterro concluído', svc: ['S07', 'S08'] },
  { id: 'BLC-1', nome: 'Subleito regularizado', svc: ['S09'] },
  { id: 'BLC-2', nome: 'Sub-base', svc: ['S11'] },
  { id: 'BLC-3', nome: 'Base', svc: ['S12', 'R1'] },
  { id: 'BLC-4', nome: 'Imprimação curada', svc: ['S13'], cura: 1 },
  { id: 'BLC-5', nome: 'Revestimento', svc: ['S14', 'S15', 'R2'] },
  { id: 'ACEITE', nome: 'Aceitação final', svc: ['S16'] }
];
function gateDays() {
  for (const g of GATES) {
    const ts = TT.filter(t => g.svc.includes(t.svc));
    const sv = g.svc.map(svcById).filter(Boolean);
    g.day = Math.max(...ts.map(t => t.day), ...sv.map(s => (s.cura ? s.cura[1] : s.b))) + 0.04;
    g.n = ts.length;
    g.svcs = sv;
  }
}
function gateStatus(g, d) {
  const done = TT.filter(t => g.svc.includes(t.svc) && t.day <= d);
  const last = {};
  for (const t of done) last[t.nome + '|' + (t.s ?? '') + '|' + (t.z ?? '')] = t;
  const open = Object.values(last).filter(t => !t.ok).length;
  if (d >= g.day) return { k: 'ok', txt: 'emitido', done: done.length, open };
  if (done.length) return { k: open ? 'bad' : 'run', txt: open ? 'não conformidade aberta' : 'em ensaio', done: done.length, open };
  return { k: 'pend', txt: 'pendente', done: 0, open };
}

// ---------- montagem da interface ----------
function initUI() {
  $('meta').textContent =
    `Trecho de ${P.L} m · pista de ${nf(P.W_RV, 1)} m · CBUQ 5 cm sobre base de 15 cm e sub-base de 20 cm · ${nf(END, 0)} dias úteis a partir de ${fmtDate(0)}`;
  // vistas
  document.querySelectorAll('[data-view]').forEach(
    b =>
      (b.onclick = () => {
        document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b));
        setView(b.dataset.view);
      })
  );
  // camadas
  const LAYS = [
    ['grp', 'Modelo'],
    ['terreno', 'Terreno e terraplenagem', '#a3591c'],
    ['pavimento', 'Pavimento', '#3b4650'],
    ['usina', 'Usina de CBUQ', '#c7851a'],
    ['canteiro', 'Canteiro e estoques', '#728078'],
    ['equip', 'Equipamentos', '#5a6340'],
    ['grp', 'Informação'],
    ['ensaios', 'Pontos de ensaio', 'var(--ok)'],
    ['rotulos', 'Estacas e rótulos', '#d9a21b'],
    ['entorno', 'Vila Militar (entorno)', '#e4d6b0']
  ];
  $('layers').innerHTML = LAYS.map(([k, n, c]) =>
    k === 'grp'
      ? `<div class="grp">${n}</div>`
      : `<label class="layer"><input type="checkbox" data-lay="${k}" checked><span class="sw" style="--c:${c}"></span><span class="l">${n}</span></label>`
  ).join('');
  $('layers')
    .querySelectorAll('input')
    .forEach(
      i =>
        (i.onchange = () => {
          const k = i.dataset.lay;
          ST.lay[k] = i.checked;
          LAY[k].visible = i.checked && !(ST.profile && ['entorno', 'canteiro', 'usina'].includes(k));
          if (k === 'rotulos') labels.forEach(l => (l.visible = i.checked));
        })
    );
  // cenário
  $('optCen').innerHTML = Object.entries(CENARIOS)
    .map(([k, v]) => `<option value="${k}">${v.nome}</option>`)
    .join('');
  $('optCen').onchange = e => {
    setCEN(e.target.value);
    rebuildAll();
  };
  $('optSpd')
    .querySelectorAll('button')
    .forEach(
      b =>
        (b.onclick = () => {
          ST.speed = +b.dataset.spd;
          syncSpeed();
        })
    );
  $('optEx').onchange = e => {
    setExag(e.target.checked ? 3 : 1);
    buildPavement();
    buildMarkers();
    if (ST.profile) setProfileClip(true);
    resetTerrKey();
    tick(true);
  };
  $('optFollow').onchange = e => {
    ST.follow = e.target.checked;
  };
  // barra 4D
  $('play').onclick = () => {
    if (GAME.on && !GAME.started) {
      briefing();
      return;
    }
    if (GAME.on && GAME.finished) {
      finishGame();
      return;
    }
    if (!ST.playing && ST.day >= END - 0.01 && !GAME.on) ST.day = 0;
    setPlaying(!ST.playing);
  };
  $('stg').oninput = e => goDay(+e.target.value);
  document.querySelectorAll('[data-mode]').forEach(b => (b.onclick = () => setMode(b.dataset.mode)));
  $('prev').onclick = () => jumpSvc(-1);
  $('next').onclick = () => jumpSvc(1);
  $('infox').onclick = hideInfo;
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      $('play').click();
    }
    if (e.key === 'ArrowRight') jumpSvc(1);
    if (e.key === 'ArrowLeft') jumpSvc(-1);
  });
  // abas
  document.querySelectorAll('[data-tab]').forEach(b => (b.onclick = () => openTab(b.dataset.tab)));
  ST.tab = 'seq';
  ST.man = 'S15';
  const savedTab = lsGet('vm4d.tab');
  if (savedTab && document.querySelector(`[data-tab="${savedTab}"]`)) {
    ST.tab = savedTab;
    document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === savedTab));
  }
  rebuildAll(true);
  camAt(20, -30, -75, 60, 110);
}
function rebuildAll(first) {
  rebuild();
  gateDays();
  $('stg').max = END;
  if (first) ST.day = 28.42;
  ST.day = Math.min(ST.day, END);
  $('cenDesc').textContent = CENARIOS[CEN].desc;
  buildMarkers();
  resetTerrKey();
  ST.sel = null;
  hideInfo();
  renderGates();
  renderTab();
  tick(true);
}
function setPlaying(on) {
  ST.playing = on;
  $('play').setAttribute('aria-pressed', on);
  $('play').textContent = on ? '❚❚ Pausar' : GAME.on && !GAME.started ? '▶ Iniciar missão' : '▶ Executar a obra';
}
function goDay(d) {
  setPlaying(false);
  d = clamp(d, 0, END);
  ST.day = gameGate(d);
  tick(true);
}
function syncSpeed() {
  $('optSpd')
    .querySelectorAll('button')
    .forEach(x => x.setAttribute('aria-pressed', +x.dataset.spd === ST.speed));
}
function openTab(t) {
  ST.tab = t;
  lsSet('vm4d.tab', t);
  document.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === t));
  renderTab();
}
function svcStarts() {
  const xs = [];
  for (const s of SVC) {
    if (s.win) s.win.forEach(w => xs.push(w[0]));
    else Object.values(s.lanes).forEach(w => xs.push(w[0]));
  }
  return [...new Set(xs)].sort((a, b) => a - b);
}
function jumpSvc(dir) {
  const xs = svcStarts().concat([END]);
  const d = ST.day;
  let t = dir > 0 ? xs.find(x => x > d + 0.02) : [...xs].reverse().find(x => x < d - 0.02);
  if (t == null) t = dir > 0 ? END : 0;
  goDay(t + (dir > 0 && t < END ? 0.02 : 0));
}
function renderGates() {
  $('systems').innerHTML = GATES.map(
    g => `<button data-gate="${g.id}" aria-pressed="false" title="${esc(g.nome)}: dia ${nf(g.day, 1)}">${g.id} · ${esc(g.nome)}</button>`
  ).join('');
  $('systems')
    .querySelectorAll('button')
    .forEach(
      b =>
        (b.onclick = () => {
          const g = GATES.find(x => x.id === b.dataset.gate);
          goDay(Math.min(END, g.day + 0.01));
        })
    );
}
function updateGates() {
  $('systems')
    .querySelectorAll('button')
    .forEach(b => {
      const g = GATES.find(x => x.id === b.dataset.gate),
        s = gateStatus(g, ST.day);
      b.setAttribute('aria-pressed', s.k === 'ok');
      b.dataset.k = s.k;
      b.title = `${g.nome}: ${s.txt}${s.k === 'ok' ? ' no dia ' + nf(g.day, 1) : ''}`;
    });
}

// ---------- painel "agora na obra" e barra ----------
function activeList(d) {
  const out = [];
  for (const s of SVC) {
    let w = null,
      lane = null;
    if (s.win) w = s.win.find(x => d >= x[0] && d < x[1]);
    else
      for (const k in s.lanes)
        if (d >= s.lanes[k][0] && d < s.lanes[k][1]) {
          w = s.lanes[k];
          lane = k;
        }
    if (s.falha && d >= s.falha.a && d < s.falha.b) {
      w = [s.falha.a, s.falha.b];
      lane = 'BD';
    }
    if (w) out.push({ s, p: (d - w[0]) / (w[1] - w[0]), lane });
    else if (s.cura && d >= s.cura[0] && d < s.cura[1]) out.push({ s, p: (d - s.cura[0]) / (s.cura[1] - s.cura[0]), cura: 1 });
  }
  return out;
}
let lastUI = -1;
function updateUI(force) {
  const d = ST.day;
  if (!force && Math.abs(d - lastUI) < 0.004) return;
  lastUI = d;
  $('stg').value = d;
  const act = activeList(d);
  const hour = fmtHour(d);
  $('stgl').innerHTML =
    `<b>Dia útil ${Math.min(Math.floor(d) + 1, Math.ceil(END))} de ${Math.ceil(END)}</b> · ${fmtDate(d)} · ${hour} · ${act.length ? act.map(a => esc(a.s.nome) + (a.lane ? ' (' + a.lane + ')' : '')).join(' · ') : d >= END - 0.01 ? 'Obra concluída e entregue' : 'Sem frente de serviço em execução'}`;
  $('nowDate').textContent = fmtDate(d, false);
  const badges = [`<span class="chip">Dia ${Math.min(Math.floor(d) + 1, Math.ceil(END))} · ${fmtDate(d)} · ${hour}</span>`];
  act.forEach(a =>
    badges.push(
      `<span class="chip" style="--c:${GRP[a.s.g].c}"><i class="dot"></i>${esc(a.s.id)} ${esc(a.s.nome.split(':')[0])}${a.lane ? ' · ' + a.lane : ''}${a.cura ? ' · cura' : ''}</span>`
    )
  );
  const nc = TT.filter(t => !t.ok && t.day <= d && t.day > d - 0.6);
  nc.forEach(t => badges.push(`<span class="chip ncf">Não conformidade: ${esc(t.nome)} (${esc(t.v)} ${esc(t.u)})</span>`));
  if (ST.labPulse) badges.push(`<span class="chip lab">Laboratório: ${ST.labPulse} ensaio${ST.labPulse > 1 ? 's' : ''} no dia</span>`);
  $('badges').innerHTML = badges.join('');
  // agora na obra
  let h = '';
  if (!act.length)
    h += `<p class="muted">${d >= END - 0.01 ? 'Obra concluída. O Termo de Recebimento Provisório foi assinado.' : 'Nenhuma frente em execução neste instante.'}</p>`;
  for (const a of act) {
    const s = a.s;
    h += `<div class="now-svc${s.rework ? ' rw' : ''}"><div class="now-h"><i class="dot" style="--c:${GRP[s.g].c}"></i><b>${esc(s.id)}</b> ${esc(s.nome)}${a.lane ? ` <span class="tag">${a.lane === 'BD' ? 'faixa direita' : 'faixa esquerda'}</span>` : ''}${a.cura ? ' <span class="tag">cura</span>' : ''}</div>
      <div class="pbar"><span style="width:${Math.round(a.p * 100)}%"></span></div>
      <div class="now-m">${esc(s.norma)} · ${esc(s.efetivo)}</div>
      ${a.cura ? '' : `<div class="now-eq">${s.eq.map(([n, q]) => `<span>${q}× ${esc(n)}</span>`).join('')}</div>`}</div>`;
  }
  const recent = TT.filter(t => t.day <= d && t.day > d - 0.6)
    .slice(-4)
    .reverse();
  if (recent.length)
    h += `<div class="grp">Ensaios recentes</div><ul class="tlist">${recent.map(t => `<li data-t="${t.id}"><span class="${t.ok ? 'ok' : 'bad'}">${t.ok ? '✓' : '✕'}</span><span class="tn">${esc(t.nome)}${t.s != null ? ` <small>est. ${estStr(t.s)}</small>` : ''}</span><b>${esc(t.v)} ${esc(t.u)}</b></li>`).join('')}</ul>`;
  const nextG = GATES.find(g => d < g.day);
  if (nextG) {
    const s = gateStatus(nextG, d);
    h += `<div class="grp">Próxima liberação</div><div class="gate ${s.k}"><b>${nextG.id}</b> ${esc(nextG.nome)}<span>${s.done} de ${nextG.n} ensaios · ${s.txt}</span></div>`;
  }
  $('now').innerHTML = h;
  $('now')
    .querySelectorAll('[data-t]')
    .forEach(
      li =>
        (li.onclick = () =>
          selectTest(
            TT.find(t => t.id === li.dataset.t),
            true
          ))
    );
  updateGates();
  if (ST.tab === 'seq') {
    const ln = document.getElementById('gNow');
    if (ln) {
      const x = GX(d);
      ln.setAttribute('x1', x);
      ln.setAttribute('x2', x);
    }
  }
  if (GAME.on) updateHud();
  if (ST.tab === 'ctrl' || ST.tab === 'lab' || ST.tab === 'diario') {
    if (!ST._tabT || performance.now() - ST._tabT > 400) {
      ST._tabT = performance.now();
      renderTab(true);
    }
  }
}

// ---------- info flutuante ----------
function showInfo(t, d, extra = '') {
  $('infot').textContent = t;
  $('infod').innerHTML =
    Object.entries(d || {})
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join('') + extra;
  $('info').hidden = false;
}
function hideInfo() {
  $('info').hidden = true;
  if (ST.sel) {
    ST.sel = null;
  }
}
function selectTest(t, jump) {
  if (!t) return;
  ST.sel = t;
  if (jump) {
    if (ST.day < t.day || (t.until != null && ST.day >= t.until)) goDay(t.day + 0.01);
    else setPlaying(false);
    if (ST.day < t.day) return;
  }
  const d = {
    Serviço: t.svc + ' · ' + (svcById(t.svc) || {}).nome,
    Norma: t.norma,
    Data: fmtDate(t.day) + ' · ' + fmtHour(t.day),
    Resultado: `${t.v} ${t.u}`.trim(),
    Critério: t.crit
  };
  if (t.s != null) {
    d.Local = `est. ${estStr(t.s)} · ${t.z > 1 ? 'bordo direito' : t.z < -1 ? 'bordo esquerdo' : 'eixo'}`;
  }
  if (t.w) d['Umidade de campo'] = t.w + ' %';
  if (t.esp) d['Espessura do CP'] = t.esp + ' cm';
  d.Situação = t.ok ? (t.re ? 'Conforme (reensaio)' : 'Conforme') : 'Não conforme';
  showInfo((t.ok ? '✓ ' : '✕ ') + t.nome, d, t.obs ? `<p class="obs">${esc(t.obs)}</p>` : '');
  if (jump && t.s != null) {
    const target = new THREE.Vector3(wx(t.s), wy(t.y), t.z);
    ST.follow = false;
    $('optFollow').checked = false;
    setCamAnim({ p0: camera.position.clone(), t0: controls.target.clone(), p: target.clone().add(new THREE.Vector3(-22, 16, 26)), t: target, k: 0 });
  }
  tick(true);
}

// ---------- abas ----------
function renderTab(soft) {
  const p = $('pane');
  const sc = soft ? p.scrollTop : 0;
  const fn = { seq: tabSeq, ctrl: tabCtrl, lab: tabLab, usina: tabUsina, quant: tabQuant, ctx: tabCtx, missao: tabMissao, diario: tabDiario }[ST.tab] || tabSeq;
  if (soft && ST.tab === 'ctrl') {
    const f1 = $('fSvc') && $('fSvc').value,
      f2 = $('fSt') && $('fSt').value;
    p.innerHTML = fn();
    if (f1 != null) {
      $('fSvc').value = f1;
      $('fSt').value = f2;
    }
    bindTab();
    filterReg();
    return;
  }
  p.innerHTML = fn();
  bindTab();
  if (soft) p.scrollTop = sc;
}
let GX = d => d;
function tabSeq() {
  const W = 1000,
    left = 300,
    top = 34,
    rh = 22,
    rows = SVC.length,
    H = top + rows * rh + 58;
  const x = d => left + (d / (END + 0.5)) * (W - left - 14);
  GX = x;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cronograma da obra"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--panel-2)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted)" stroke-width="2"/></pattern></defs>`;
  for (let d = 0; d <= END; d += 5)
    s += `<line x1="${x(d)}" x2="${x(d)}" y1="${top - 6}" y2="${H - 40}" stroke="var(--line-2)"/><text x="${x(d) + 3}" y="${top - 12}">${fmtDate(d, false).slice(0, 5)}</text>`;
  SVC.forEach((v, i) => {
    const y = top + i * rh;
    const c = GRP[v.g].c;
    s += `<g class="row${ST.man === v.id ? ' sel' : ''}" data-svc="${v.id}"><rect class="bg" x="0" y="${y}" width="${W}" height="${rh}" fill="transparent"/>`;
    s += `<text x="8" y="${y + 15}" style="font-family:var(--f-mono);fill:var(--muted)">${v.id}</text><text x="44" y="${y + 15}"${v.rework ? ' style="fill:var(--bad)"' : ''}>${esc(v.nome.length > 44 ? v.nome.slice(0, 43) + '…' : v.nome)}</text>`;
    const ws = v.win ? v.win.map(w => [w, '']) : Object.entries(v.lanes).map(([k, w]) => [w, k]);
    ws.forEach(([w, k]) => {
      s += `<rect x="${x(w[0])}" y="${y + 5}" width="${Math.max(3, x(w[1]) - x(w[0]))}" height="${rh - 10}" rx="3" fill="${v.rework ? 'var(--bad)' : c}"><title>${k ? (k === 'BD' ? 'Faixa direita' : 'Faixa esquerda') + ': ' : ''}${fmtDate(w[0])} ${fmtHour(w[0])} a ${fmtHour(w[1])}</title></rect>`;
    });
    if (v.lanes)
      s += `<text x="${x(Math.max(...Object.values(v.lanes).map(w => w[1]))) + 4}" y="${y + 15}" style="font-size:10px;fill:var(--muted)">BD → BE</text>`;
    if (v.cura)
      s += `<rect x="${x(v.cura[0])}" y="${y + 5}" width="${x(v.cura[1]) - x(v.cura[0])}" height="${rh - 10}" rx="3" fill="url(#hatch)" stroke="var(--muted)" stroke-width=".6"/><text x="${x(v.cura[1]) + 3}" y="${y + 15}" style="font-size:10px;fill:var(--muted)">cura</text>`;
    if (v.falha)
      s += `<rect x="${x(v.falha.a)}" y="${y + 5}" width="${Math.max(3, x(v.falha.b) - x(v.falha.a))}" height="${rh - 10}" rx="2" fill="var(--bad)"/>`;
    s += `</g>`;
  });
  const gy = H - 46;
  s += `<text x="8" y="${gy + 14}" style="font-weight:600">Liberações de camada (BLC)</text>`;
  GATES.forEach((g, i) => {
    const xx = x(g.day);
    s += `<g><title>${g.id} · ${esc(g.nome)} · ${fmtDate(g.day)}</title><path d="M${xx} ${gy + 2} l7 7 l-7 7 l-7 -7z" fill="var(--accent)"/><text x="${xx}" y="${gy + 30 + (i % 2) * 11}" text-anchor="middle" style="font-size:9.5px;fill:var(--ink-2)">${g.id}</text></g>`;
  });
  s += `<line id="gNow" x1="${x(ST.day)}" x2="${x(ST.day)}" y1="${top - 6}" y2="${H - 6}" stroke="var(--brass)" stroke-width="2"/></svg>`;
  const legend =
    Object.values(GRP)
      .map(g => `<span><i class="dot" style="--c:${g.c}"></i>${g.nome}</span>`)
      .join('') + `<span><i class="dot" style="--c:var(--bad)"></i>Retrabalho / não conformidade</span><span><i class="dot hatch"></i>Cura</span>`;
  return `<div class="pane-head"><h2>Sequência executiva</h2><p>Cada barra é uma frente de serviço em dias úteis. Os losangos marcam a emissão de cada Boletim de Liberação de Camada, que só acontece depois do último ensaio conforme. Clique em uma linha para ir ao início do serviço e abrir o procedimento.</p></div>
  <div class="legend">${legend}</div><div class="gantt">${s}</div>${manualHTML()}`;
}
const CURTO = {
  S01: 'Mobilização e canteiro',
  S02: 'Locação topográfica',
  S03: 'Ensaios prévios',
  S04: 'Limpeza e destocamento',
  S05: 'Montagem da usina',
  S06: 'Corte e transporte',
  S07: 'Aterro: corpo',
  S08: 'Aterro: camada final',
  S09: 'Regularização do subleito',
  S10: 'Dosagem e calibração',
  S11: 'Sub-base solo-brita',
  S12: 'Base brita graduada',
  S13: 'Imprimação',
  S14: 'Pintura de ligação',
  S15: 'CBUQ',
  S16: 'Controle final',
  S17: 'Desmobilização e entrega',
  R1: 'Retrabalho na base',
  R2: 'Usina parada e fresagem'
};
function manualHTML() {
  const v = svcById(ST.man) || SVC[0];
  const m = MANUAL[v.id] || { onde: '', como: [], chk: [] };
  const ts = TT.filter(t => t.svc === v.id),
    ok = ts.filter(t => t.ok).length;
  const win = v.win
    ? v.win.map(w => `${fmtDate(w[0], false)} a ${fmtDate(Math.max(w[0], w[1] - 0.01), false)}`).join(', ')
    : Object.entries(v.lanes)
        .map(([k, w]) => `${k}: ${fmtDate(w[0], false)}`)
        .join(' · ');
  const steps = SVC.map(
    s =>
      `<button class="${s.id === v.id ? 'on' : ''}" data-man="${s.id}"><b>${s.id.startsWith('R') ? s.id : s.id.replace('S', '').replace(/^0/, '')}</b>${esc(CURTO[s.id] || s.nome)}</button>`
  ).join('');
  return `<div class="man"><div class="man-steps">${steps}</div>
  <article class="man-card"><header><span class="man-n">${v.id}</span><div><h3>${esc(v.nome)}</h3><p class="man-meta">${esc(v.norma)} · ${win} · dias ${nf(v.a, 1)} a ${nf(v.b, 1)}</p></div></header>
  <div class="man-onde"><span>Onde</span>${esc(m.onde)}</div>
  <div class="man-grid"><div><h4>Como executar</h4><ol>${m.como.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>
  <div class="man-side"><h4>Conferir antes de liberar</h4><ul class="man-chk">${m.chk.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
  <h4>Equipe e equipamentos</h4><p>${esc(v.efetivo)}</p><ul class="man-mat">${v.eq.map(([n, q]) => `<li><span>${esc(n)}</span><b>${q}</b></li>`).join('')}</ul>
  <h4>Liberação</h4><p>${esc(v.lib)}</p></div></div>
  <footer><span>${ts.length ? `${ts.length} ensaios vinculados · ${ok} conformes · ${ts.length - ok} não conformes` : 'Sem ensaios vinculados'}</span><button class="btn sm" data-goto="${v.a}">Ver no modelo ▶</button></footer></article></div>`;
}

// plano de controle tecnológico
const PLANO = [
  [
    'S07',
    'Massa específica in situ (GC)',
    'Frasco de areia, DNER-ME 092/94',
    '≥ 5 por camada (plano estatístico, n de 5 a 21)',
    'GC ≥ 100 % do Proctor normal; h = hót ± 3 %'
  ],
  ['S07', 'Compactação do material', 'DNER-ME 129/94, Método A', '1 a cada 1 000 m³', 'Referência para o GC'],
  ['S08', 'Massa específica in situ (GC)', 'Frasco de areia, DNER-ME 092/94', '≥ 5 por subcamada (até 800 m³)', 'GC ≥ 100 % (Método B)'],
  ['S08', 'Compactação · ISC', 'DNER-ME 129/94 · DNER-ME 049/94', '1 a cada 200 m³ · ISC a cada 4 compactações', 'ISC ≥ 6 % · expansão ≤ 2 %'],
  ['S09', 'Umidade · GC', 'Speedy DNER-ME 052/94 · frasco de areia', 'Umidade a cada 100 m · GC mín. 5 determinações', 'GC ≥ 100 % · h = hót ± 2 %'],
  ['S09', 'Controle geométrico', 'Nivelamento', 'Eixo e bordos a cada 20 m', 'Cotas ± 3 cm · largura ± 10 cm'],
  [
    'S11',
    'Caracterização · compactação · ISC',
    'DNER-ME 080, 082, 122, 129 e 049',
    'A cada 200 m (ISC a cada 400 m); mín. 5 em pistas até 4 000 m²',
    'ISC ≥ 20 % · exp. ≤ 1 % · IG = 0'
  ],
  ['S11', 'Umidade · GC', 'Speedy · frasco de areia', '1 por camada a cada 100 m (mín. 5)', 'GC ≥ 100 % · espessura ± 10 %'],
  [
    'S12',
    'Umidade · compactação · ISC',
    'DNER-ME 052 · DNIT 164-ME · DNIT 172-ME',
    'Umidade a cada 100 m · ISC a cada 200 m ou por jornada',
    'ISC ≥ 60 % · exp. ≤ 0,5 % · LL ≤ 25 % · IP ≤ 6 %'
  ],
  [
    'S12',
    'GC · deflexão',
    'Frasco de areia · viga Benkelman DNER-ME 024/94',
    'GC conforme plano de amostragem · deflexão a cada 20 m em faixas alternadas (mín. 15)',
    'GC ≥ 100 % · Dc = D̄ + k·S ≤ projeto'
  ],
  ['S13', 'Taxa de aplicação', 'Bandejas de massa e área conhecidas', 'Mín. 5 determinações (até 4 000 m²)', '1,20 ± 0,20 L/m² · T ≥ 10 °C · sem chuva'],
  ['S14', 'Taxa de aplicação', 'Bandejas', 'Mín. 5 determinações', '0,90 ± 0,20 L/m² (diluída 1:1)'],
  ['S15', 'Temperaturas', 'Termômetro e pirômetro', 'Agregados e CAP a cada 4 h · massa em cada caminhão', 'CAP 107 a 177 °C · espalhamento ≥ 145 °C'],
  ['S15', 'Teor de ligante · granulometria · Gmm', 'Rotarex · DNIT 412-ME · DNIT 427-ME', 'A cada 4 h de produção', 'Teor ± 0,3 % · Tabela 3 de tolerâncias'],
  ['S15', 'Resistência à tração · dano por umidade', 'DNIT 136-ME · DNIT 180-ME', 'RT diária · RRT a cada 5 dias', 'RT ≥ 0,65 MPa · RRT ≥ 0,70'],
  ['S15', 'GC · espessura', 'Corpos de prova extraídos, DNIT 428-ME', '1 a cada 100 m', '97 % ≤ GC ≤ 100 % · espessura ± 5 %'],
  [
    'S16',
    'Deflexão · irregularidade · regularidade',
    'DNIT 133-ME · DNIT 442-ME · régua de 3 m',
    'Deflexão a cada 20 m · IRI e régua a cada 200 m',
    'IRI ≤ 2,0 m/km · régua ≤ 0,5 cm'
  ],
  ['S16', 'Atrito · macrotextura', 'Pêndulo britânico · mancha de areia', 'A cada 300 m', 'VDR ≥ 47 · macrotextura conforme projeto']
];
function tabCtrl() {
  const d = ST.day;
  const done = TT.filter(t => t.day <= d);
  const nc = done.filter(t => !t.ok).length;
  const gOk = GATES.filter(g => d >= g.day).length;
  const opts = SVC.filter(s => TT.some(t => t.svc === s.id))
    .map(s => `<option value="${s.id}">${s.id} · ${esc(s.nome.split(':')[0])}</option>`)
    .join('');
  return `<div class="pane-head"><h2>Controle tecnológico</h2><p>O plano de controle define, para cada serviço, o ensaio, a norma, a frequência e o critério de aceitação. O registro abaixo é preenchido conforme a obra avança no modelo. Clique em um ensaio para vê-lo na pista.</p></div>
  <div class="kpis"><div class="kpi"><b>${done.length} de ${TT.length}</b><span>Ensaios realizados até o dia</span></div><div class="kpi"><b class="ok">${done.length - nc}</b><span>Conformes</span></div><div class="kpi"><b class="${nc ? 'bad' : ''}">${nc}</b><span>Não conformes (com reensaio)</span></div><div class="kpi"><b>${gOk} de ${GATES.length}</b><span>Liberações de camada emitidas</span></div></div>
  <h3 class="h3">Plano de controle</h3>
  <div class="tbl"><table><thead><tr><th>Serviço</th><th>Controle</th><th>Método</th><th>Frequência</th><th>Critério de aceitação</th></tr></thead><tbody>${PLANO.map(r => `<tr><td class="m">${r[0]}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">Como o trecho é curto (menos de 4 000 m² por camada), vale o mínimo de 5 determinações por camada previsto nas especificações, mesmo onde a frequência por distância daria menos.</p>
  <h3 class="h3">Registro de ensaios</h3>
  <div class="form"><label>Serviço<select id="fSvc"><option value="">Todos</option>${opts}</select></label><label>Situação<select id="fSt"><option value="">Todas</option><option value="ok">Conforme</option><option value="bad">Não conforme</option><option value="fut">Previsto</option></select></label></div>
  <div class="tbl reg"><table><thead><tr><th>Nº</th><th>Data</th><th>Serviço</th><th>Ensaio</th><th>Local</th><th class="n">Resultado</th><th>Critério</th><th>Situação</th></tr></thead><tbody>${TT.map(
    t => {
      const fut = t.day > d;
      return `<tr class="click${ST.sel === t ? ' sel' : ''}" data-t="${t.id}" data-svc="${t.svc}" data-st="${fut ? 'fut' : t.ok ? 'ok' : 'bad'}"><td class="m">${t.id}</td><td class="m">${fmtDate(t.day, false).slice(0, 5)}</td><td class="m">${t.svc}</td><td>${esc(t.nome)}</td><td class="m">${t.s != null ? 'est. ' + estStr(t.s) + ' ' + (t.z > 1 ? 'BD' : t.z < -1 ? 'BE' : 'eixo') : t.tipo === 'usina' ? 'usina' : 'laboratório'}</td><td class="n">${fut ? '—' : esc((t.v + ' ' + t.u).trim())}</td><td>${esc(t.crit)}</td><td>${fut ? '<span class="muted">previsto</span>' : t.ok ? '<span class="ok">conforme</span>' : '<span class="bad">não conforme</span>'}</td></tr>`;
    }
  ).join('')}</tbody></table></div>`;
}
function filterReg() {
  const a = $('fSvc') ? $('fSvc').value : '',
    b = $('fSt') ? $('fSt').value : '';
  document.querySelectorAll('.reg tbody tr').forEach(r => (r.hidden = (a && r.dataset.svc !== a) || (b && r.dataset.st !== b)));
}

// ---------- gráficos ----------
function chart(o) {
  const W = o.w || 460,
    H = o.h || 260,
    m = { l: 52, r: 26, t: 16, b: 40 };
  const [x0, x1] = o.x,
    [y0, y1] = o.y;
  const lx = o.logx;
  const X = v => m.l + ((lx ? Math.log10(v) - Math.log10(x0) : v - x0) / (lx ? Math.log10(x1) - Math.log10(x0) : x1 - x0)) * (W - m.l - m.r);
  const Y = v => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b);
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(o.title || '')}">`;
  (o.yt || []).forEach(
    v =>
      (s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line-2)"/><text x="${m.l - 6}" y="${Y(v) + 4}" text-anchor="end">${o.yf ? o.yf(v) : v}</text>`)
  );
  (o.xt || []).forEach(
    v =>
      (s += `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--line-2)"/><text x="${X(v)}" y="${H - m.b + 15}" text-anchor="middle">${o.xf ? o.xf(v) : v}</text>`)
  );
  (o.bands || []).forEach(
    b =>
      (s += `<rect x="${m.l}" width="${W - m.l - m.r}" y="${Y(Math.min(b[1], y1))}" height="${Math.max(0, Y(Math.max(b[0], y0)) - Y(Math.min(b[1], y1)))}" fill="${b[2] || 'var(--accent-soft)'}" opacity=".7"/>`)
  );
  (o.area || []).forEach(a => {
    const up = a.pts.map(p => `${X(p[0])},${Y(p[2])}`),
      dn = a.pts
        .slice()
        .reverse()
        .map(p => `${X(p[0])},${Y(p[1])}`);
    s += `<polygon points="${up.concat(dn).join(' ')}" fill="${a.c}" opacity=".18"/>`;
  });
  (o.hl || []).forEach(
    h =>
      (s += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(h[0])}" y2="${Y(h[0])}" stroke="${h[1] || 'var(--bad)'}" stroke-dasharray="5 4" stroke-width="1.4"/><text x="${h[3] ? m.l + 6 : W - m.r - 4}" y="${Y(h[0]) + (h[4] || -5)}" text-anchor="${h[3] ? 'start' : 'end'}" style="fill:${h[1] || 'var(--bad)'}">${esc(h[2] || '')}</text>`)
  );
  (o.vl || []).forEach(
    h =>
      (s += `<line y1="${m.t}" y2="${H - m.b}" x1="${X(h[0])}" x2="${X(h[0])}" stroke="${h[1] || 'var(--brass)'}" stroke-dasharray="4 4" stroke-width="1.4"/><text x="${X(h[0]) + 4}" y="${m.t + 11}" style="fill:${h[1] || 'var(--brass)'}">${esc(h[2] || '')}</text>`)
  );
  (o.bars || []).forEach(b => {
    const bw = b.w || 10;
    b.pts.forEach(
      p =>
        (s += `<rect x="${X(p[0]) - bw / 2}" width="${bw}" y="${Y(p[1])}" height="${Y(y0) - Y(p[1])}" rx="2" fill="${p[2] || b.c}" opacity="${p[3] ? 0.35 : 1}"><title>${esc(p[4] || '')}</title></rect>`)
    );
  });
  (o.lines || []).forEach(l => {
    s += `<polyline points="${l.pts.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="${l.c}" stroke-width="${l.w || 2}" ${l.dash ? `stroke-dasharray="${l.dash}"` : ''}/>`;
    if (l.dots) l.pts.forEach(p => (s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.4" fill="var(--panel)" stroke="${l.c}" stroke-width="2"/>`));
  });
  (o.dots || []).forEach(
    d =>
      (s += `<circle cx="${X(d[0])}" cy="${Y(d[1])}" r="${d[4] || 4.5}" fill="${d[3] ? 'var(--panel)' : d[2]}" stroke="${d[2]}" stroke-width="1.6"><title>${esc(d[5] || '')}</title></circle>`)
  );
  s += `<line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}" stroke="var(--ink-2)"/><line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}" stroke="var(--ink-2)"/>`;
  if (o.xl) s += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle" class="ax">${esc(o.xl)}</text>`;
  if (o.yl) s += `<text transform="translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle" class="ax">${esc(o.yl)}</text>`;
  return s + '</svg>';
}
const card = (t, sub, body, leg = '') =>
  `<div class="ccard"><h4>${esc(t)}</h4>${sub ? `<p class="csub">${sub}</p>` : ''}${body}${leg ? `<div class="legend sm">${leg}</div>` : ''}</div>`;
const lg = (c, n, k = 'dot') => `<span><i class="${k}" style="--c:${c}"></i>${esc(n)}</span>`;

function tabLab() {
  const d = ST.day;
  const out = [];
  out.push(
    `<div class="pane-head"><h2>Laboratório</h2><p>Resultados de laboratório e de campo. Os pontos cheios já foram ensaiados no dia exibido; os vazados ainda estão previstos. Avance a obra para ver os gráficos se completarem.</p></div><div class="cgrid">`
  );
  // compactação
  out.push(
    card(
      'Curvas de compactação',
      'Massa específica aparente seca × umidade, com o ponto ótimo de cada material.',
      chart({
        x: [2, 24],
        y: [1.6, 2.36],
        xt: [4, 8, 12, 16, 20, 24],
        yt: [1.6, 1.8, 2.0, 2.2],
        yf: v => nf(v, 2),
        xl: 'Umidade (%)',
        yl: 'γd (g/cm³)',
        lines: PROCTOR.map(p => ({ pts: p.pts, c: p.c, dots: 1 })),
        dots: PROCTOR.map(p => [p.hot, p.gmax, p.c, 0, 6, `${p.nome}: hót ${nf(p.hot)} %, γd ${nf(p.gmax, 3)}`])
      }),
      PROCTOR.map(p => lg(p.c, `${p.nome} · hót ${nf(p.hot)} %`)).join('')
    )
  );
  // GC por camada
  const LC = { corpo: 'var(--c-esg)', cf: 'var(--c-tug)', reg: 'var(--c-ilum)', sb: 'var(--c-clima)', ba: 'var(--c-alim)' };
  const gcs = TT.filter(t => /^GC (corpo|camada|regulariza|sub-base|base)/.test(t.nome));
  out.push(
    card(
      'Grau de compactação das camadas',
      'Frasco de areia ao longo do trecho. O critério é GC ≥ 100 %; o ponto vermelho é a reprovação seguida de reensaio.',
      chart({
        x: [0, 300],
        y: [96.5, 103.5],
        xt: [0, 60, 120, 180, 240, 300],
        xf: v => 'est. ' + v / 20,
        yt: [97, 98, 99, 100, 101, 102, 103],
        xl: 'Estaca',
        yl: 'GC (%)',
        hl: [[100, 'var(--bad)', 'mínimo 100 %', 1, 14]],
        dots: gcs.map(t => [
          t.s,
          parseFloat(t.v.replace(',', '.')),
          t.ok ? LC[t.layer] : 'var(--bad)',
          t.day > d,
          4.2,
          `${t.nome} · est. ${estStr(t.s)} · ${t.v} %`
        ])
      }),
      Object.entries({ corpo: 'Corpo do aterro', cf: 'Camada final', reg: 'Regularização', sb: 'Sub-base', ba: 'Base' })
        .map(([k, n]) => lg(LC[k], n))
        .join('')
    )
  );
  // Marshall
  const M = MARSHALL,
    xr = [4.4, 6.8],
    xt = [4.6, 5.1, 5.6, 6.1, 6.6],
    vl = [[5.6, 'var(--brass)', 'teor 5,6 %']];
  const mini = (t, y, yt, arr, band, yl) =>
    card(
      t,
      '',
      chart({
        w: 300,
        h: 200,
        x: xr,
        y,
        xt,
        yt,
        xf: v => nf(v, 1),
        xl: 'Teor de ligante (%)',
        yl,
        vl,
        bands: band ? [band] : [],
        lines: [{ pts: M.teor.map((v, i) => [v, arr[i]]), c: 'var(--accent)', dots: 1 }]
      })
    );
  out.push(`</div><h3 class="h3">Dosagem Marshall (75 golpes) · CAP 50/70 · faixa C-12,5</h3><div class="cgrid four">`);
  out.push(mini('Volume de vazios', [1.5, 7.5], [2, 3, 4, 5, 6, 7], M.vv, [3, 5], 'Vv (%)'));
  out.push(mini('Relação betume/vazios', [50, 85], [55, 65, 75, 85], M.rbv, [65, 75], 'RBV (%)'));
  out.push(mini('Estabilidade', [400, 1100], [500, 700, 900, 1100], M.est, [500, 1100], 'kgf'));
  out.push(mini('Vazios do agregado mineral', [13, 16], [13, 14, 15, 16], M.vam, [14, 16], 'VAM (%)'));
  out.push(`</div><div class="cgrid">`);
  // granulometria
  const G = GRAN;
  const done0 = TT.find(t => t.gran === 0),
    done1 = TT.find(t => t.gran === 1);
  const gd = [];
  G.mm.forEach((mm, i) => {
    gd.push([mm, G.usina[0][i], 'var(--c-af)', !(done0 && done0.day <= d), 4, `BD: ${G.pen[i]} ${G.usina[0][i]} %`]);
    gd.push([mm, G.usina[1][i], 'var(--c-tug)', !(done1 && done1.day <= d), 4, `BE: ${G.pen[i]} ${G.usina[1][i]} %`]);
  });
  out.push(
    card(
      'Granulometria da mistura',
      'Curva de projeto com a faixa de trabalho (projeto ± tolerâncias da Tabela 3 da DNIT 031/2024-ES) e as amostras da produção.',
      chart({
        w: 520,
        x: [0.06, 25],
        y: [0, 100],
        logx: 1,
        xt: [0.075, 0.15, 0.3, 0.6, 1.18, 2.36, 4.75, 9.5, 19],
        xf: v => (v < 1 ? nf(v, v < 0.1 ? 3 : 2) : nf(v, v < 3 ? 2 : 1)),
        yt: [0, 20, 40, 60, 80, 100],
        xl: 'Abertura da peneira (mm, escala log)',
        yl: '% passante',
        area: [{ c: 'var(--accent)', pts: G.mm.map((m, i) => [m, Math.max(0, G.proj[i] - G.tol[i]), Math.min(100, G.proj[i] + G.tol[i])]) }],
        lines: [{ pts: G.mm.map((m, i) => [m, G.proj[i]]), c: 'var(--accent)' }],
        dots: gd
      }),
      lg('var(--accent)', 'Projeto e faixa de trabalho') + lg('var(--c-af)', 'Usina, faixa direita') + lg('var(--c-tug)', 'Usina, faixa esquerda')
    )
  );
  // deflexões
  const dfl = (grp, lim, title, sub) => {
    const ts = TT.filter(t => t.grp === grp);
    const doneT = ts.filter(t => t.day <= d);
    const st = doneT.length >= 2 ? deflStats(doneT.map(t => +t.v)) : null;
    const hl = [[lim, 'var(--bad)', `projeto ${lim}`]];
    if (st) hl.push([st.dc, 'var(--accent)', `Dc = ${nf(st.dc, 1)}`]);
    return card(
      title,
      sub + (st ? ` n = ${st.n}, D̄ = ${nf(st.m, 1)}, s = ${nf(st.sd, 1)}, k = ${nf(st.k, 2)}.` : ' Medições ainda não realizadas.'),
      chart({
        x: [0, 300],
        y: [0, Math.max(80, lim + 10)],
        xt: [0, 60, 120, 180, 240, 300],
        xf: v => 'est. ' + v / 20,
        yt: [0, 20, 40, 60, 80],
        xl: 'Estaca',
        yl: 'D0 (0,01 mm)',
        hl,
        bars: [
          {
            c: 'var(--c-alim)',
            w: 11,
            pts: ts.map(t => [t.s, +t.v, t.z > 0 ? 'var(--c-alim)' : 'var(--c-clima)', t.day > d, `est. ${estStr(t.s)} ${t.z > 0 ? 'BD' : 'BE'}: ${t.v}`])
          }
        ]
      }),
      lg('var(--c-alim)', 'Faixa direita', 'dot') + lg('var(--c-clima)', 'Faixa esquerda')
    );
  };
  out.push(dfl('deflBase', 70, 'Deflexões no topo da base', 'Viga Benkelman a cada 20 m, alternando as faixas. Dc = D̄ + k·S.'));
  out.push(dfl('deflFin', 50, 'Deflexões no revestimento', 'Controle de aceitação do pavimento acabado.'));
  // GC CBUQ
  const cb = TT.filter(t => t.grp === 'gcCB');
  out.push(
    card(
      'Grau de compactação do CBUQ',
      'Corpos de prova extraídos a cada 100 m por faixa. A faixa aceitável é de 97 % a 100 %.',
      chart({
        x: [0, 300],
        y: [95, 101.5],
        xt: [0, 100, 200, 300],
        xf: v => 'est. ' + v / 20,
        yt: [95, 96, 97, 98, 99, 100, 101],
        xl: 'Estaca',
        yl: 'GC (%)',
        bands: [[97, 100]],
        dots: cb.map(t => [
          t.s,
          parseFloat(t.v.replace(',', '.')),
          t.z > 0 ? 'var(--c-af)' : 'var(--c-tug)',
          t.day > d,
          5,
          `${t.nome}: ${t.v} % · espessura ${t.esp} cm`
        ])
      }),
      lg('var(--c-af)', 'Faixa direita') + lg('var(--c-tug)', 'Faixa esquerda')
    )
  );
  out.push('</div>');
  return out.join('');
}

// ---------- usina e transporte ----------
function tabUsina() {
  const R = rng(5);
  const s15 = svcById('S15');
  const tk = ['BD', 'BE'].map(ln => {
    const w = s15.lanes[ln];
    const n = Math.ceil(Q.Trv / 2 / 12);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const day = w[0] + 0.05 + (i * (12 / 60)) / 10;
      rows.push([i + 1, fmtHourM(day), nf(11.4 + R() * 0.6, 2), Math.round(158 + gauss(R) * 1.8), Math.round(151 + gauss(R) * 1.8)]);
    }
    return { ln, rows };
  });
  return `<div class="pane-head"><h2>Usina e transporte do CBUQ</h2><p>A usina fica no próprio canteiro. O caminhão para sob o silo de massa, recebe a carga, segue coberto com lona pela avenida e pela meia pista livre, manobra à frente da vibroacabadora e descarrega de ré na caçamba da acabadora.</p></div>
  <div class="cols"><div><h3 class="h3">Componentes</h3><ul class="q comp">${USINA.map(([n, t]) => `<li><b>${esc(n)}</b><span>${esc(t)}</span></li>`).join('')}</ul></div>
  <div><h3 class="h3">Dimensionamento da frota</h3><div class="form" id="calc">
  <label>Produção da usina (t/h)<input type="number" id="cP" value="60" min="20" step="5"></label>
  <label>Carga por caminhão (t)<input type="number" id="cC" value="12" min="5" step="1"></label>
  <label>Distância usina → frente (km)<input type="number" id="cD" value="0.6" min="0.1" step="0.1"></label>
  <label>Velocidade média (km/h)<input type="number" id="cV" value="15" min="5" step="5"></label>
  <label>Descarga e manobra (min)<input type="number" id="cM" value="10" min="1" step="1"></label></div>
  <div class="readout calc" id="cOut"></div>
  <p class="note">A frota deve manter a vibroacabadora alimentada sem paradas, porque cada parada cria junta e degrau na superfície. Com a usina a 600 m, 4 caminhões bastam. Aumente a distância para ver como a frota cresce quando a massa vem de uma usina comercial distante.</p></div></div>
  <h3 class="h3">Tíquetes de pesagem e temperatura (simulados)</h3><div class="cols">${tk.map(t => `<div><div class="tbl"><table><thead><tr><th>Caminhão</th><th>Saída</th><th class="n">Massa (t)</th><th class="n">T saída (°C)</th><th class="n">T espalh. (°C)</th></tr></thead><tbody>${t.rows.map(r => `<tr><td class="m">${t.ln}-${String(r[0]).padStart(2, '0')}</td><td class="m">${r[1]}</td><td class="n">${r[2]}</td><td class="n">${r[3]}</td><td class="n ${r[4] < 145 ? 'bad' : ''}">${r[4]}</td></tr>`).join('')}</tbody></table></div><p class="csub">${t.ln === 'BD' ? 'Faixa direita' : 'Faixa esquerda'} · ${fmtDate(s15.lanes[t.ln][0])}</p></div>`).join('')}</div>
  <h3 class="h3">Temperaturas de controle</h3><div class="tbl"><table><thead><tr><th>Ponto</th><th>Faixa</th><th>Frequência</th></tr></thead><tbody>
  <tr><td>CAP 50/70 no tanque e na bomba</td><td class="m">≈ 155 °C (limite 107 a 177 °C)</td><td>A cada 4 h</td></tr>
  <tr><td>Agregados na saída do secador</td><td class="m">10 a 15 °C acima do CAP, até 177 °C</td><td>A cada 4 h</td></tr>
  <tr><td>Massa na saída da usina</td><td class="m">≈ 158 °C</td><td>Cada caminhão</td></tr>
  <tr><td>Massa no espalhamento</td><td class="m">≥ 145 °C (± 5 °C do projeto)</td><td>Cada caminhão</td></tr></tbody></table></div>`;
}
function calcFleet() {
  if (!$('cP')) return;
  const P_ = +$('cP').value,
    Cc = +$('cC').value,
    D = +$('cD').value,
    V = +$('cV').value,
    M = +$('cM').value;
  const load = (Cc / P_) * 60,
    go = (D / V) * 60,
    cyc = load + 2 * go + M,
    n = Math.ceil(cyc / load);
  const tLane = Q.Trv / 2,
    hrs = tLane / P_;
  $('cOut').innerHTML =
    `Carga no silo: <b>${nf(load, 1)} min</b> · ida e volta: <b>${nf(2 * go, 1)} min</b> · ciclo: <b>${nf(cyc, 1)} min</b><br>Caminhões em ciclo: <b>${n}</b> + 1 reserva = <b>${n + 1}</b><br>Massa por faixa: <b>${nf(tLane, 0)} t</b> · <b>${Math.ceil(tLane / Cc)}</b> viagens · usina operando <b>${nf(hrs, 1)} h</b> por faixa`;
}

// ---------- quantitativos ----------
function tabQuant() {
  const q = Q;
  const rows = q.rows
    .map(
      r =>
        `<tr><td class="m">${r.est}</td><td class="n">${nf(r.nat, 2)}</td><td class="n">${nf(r.gr, 2)}</td><td class="n">${nf(r.sg, 2)}</td><td class="n ${r.h > 0 ? '' : 'bad'}">${r.h > 0 ? nf(r.h, 2) : '−' + nf(-r.h, 2)}</td><td class="n">${nf(r.ac, 1)}</td><td class="n">${nf(r.aa, 1)}</td><td class="n">${nf(r.vc, 0)}</td><td class="n">${nf(r.va, 0)}</td><td class="n">${nf(r.cum, 0)}</td></tr>`
    )
    .join('');
  const mass = chart({
    w: 520,
    h: 250,
    x: [0, 300],
    y: [-1500, 2200],
    xt: [0, 60, 120, 180, 240, 300],
    xf: v => 'est. ' + v / 20,
    yt: [-1500, -1000, -500, 0, 500, 1000, 1500, 2000],
    yf: v => nf(v, 0),
    xl: 'Estaca',
    yl: 'Volume acumulado (m³)',
    hl: [[0, 'var(--ink-2)', '']],
    lines: [{ pts: q.rows.map(r => [r.s, r.cum]), c: 'var(--accent)', dots: 1 }]
  });
  const prof = chart({
    w: 520,
    h: 250,
    x: [0, 300],
    y: [18.5, 25.5],
    xt: [0, 60, 120, 180, 240, 300],
    xf: v => 'est. ' + v / 20,
    yt: [19, 20, 21, 22, 23, 24, 25],
    xl: 'Estaca',
    yl: 'Cota (m)',
    lines: [
      { pts: Array.from({ length: 151 }, (_, i) => [i * 2, nat(i * 2, 0)]), c: 'var(--c-esg)' },
      {
        pts: [
          [0, gr(0)],
          [300, gr(300)]
        ],
        c: 'var(--ink)',
        w: 2.4
      },
      {
        pts: [
          [0, sg(0)],
          [300, sg(300)]
        ],
        c: 'var(--muted)',
        dash: '5 4'
      }
    ]
  });
  return `<div class="pane-head"><h2>Quantitativos</h2><p>Volumes calculados pela média das áreas das seções, a cada 20 m, sobre o mesmo terreno do modelo 3D. Fator de homogeneização de ${nf(P.FH, 2)} entre o corte e o aterro compactado.</p></div>
  <div class="kpis"><div class="kpi"><b>${nf(q.Vc, 0)} m³</b><span>Corte (volume geométrico)</span></div><div class="kpi"><b>${nf(q.Va, 0)} m³</b><span>Aterro compactado</span></div><div class="kpi"><b>${nf(q.Vcf * P.FH, 0)} m³</b><span>Empréstimo para a camada final (${nf(q.Vcf, 0)} m³ compactados)</span></div><div class="kpi"><b>${nf(q.Vc - q.Vcorpo * P.FH, 0)} m³</b><span>Sobra do corte (bota-fora)</span></div><div class="kpi"><b>${nf(q.Trv, 0)} t</b><span>CBUQ (${nf(q.Vrv, 1)} m³ × 2,42 t/m³)</span></div></div>
  <div class="cgrid">${card('Perfil longitudinal', 'Terreno natural no eixo, greide do revestimento e topo da terraplenagem (40 cm abaixo).', prof, lg('var(--c-esg)', 'Terreno natural') + lg('var(--ink)', 'Greide (−0,75 %)') + lg('var(--muted)', 'Topo da terraplenagem'))}
  ${card('Diagrama de massas (Brückner)', 'Ramos ascendentes são corte; descendentes, aterro. O material do corte atende o corpo do aterro, e a camada final vem da jazida.', mass)}</div>
  <div class="cols"><div>${card('Seção-tipo do pavimento', 'Espessuras fora de escala; abaulamento de 2 %. A linha marrom entre a base e o CBUQ é a imprimação com a pintura de ligação.', secaoTipo())}</div>
  <div><h3 class="h3">Pavimentação</h3><div class="tbl"><table><thead><tr><th>Serviço</th><th class="n">Quantidade</th><th>Norma</th></tr></thead><tbody>
  <tr><td>Limpeza e destocamento</td><td class="n">${nf(q.Alimp, 0)} m²</td><td class="m">DNIT 104/2009-ES</td></tr>
  <tr><td>Regularização do subleito</td><td class="n">${nf(q.Areg, 0)} m²</td><td class="m">DNIT 137/2010-ES</td></tr>
  <tr><td>Sub-base de solo-brita, 20 cm</td><td class="n">${nf(q.Vsb, 0)} m³</td><td class="m">DNIT 139/2010-ES</td></tr>
  <tr><td>Base de brita graduada, 15 cm</td><td class="n">${nf(q.Vba, 0)} m³</td><td class="m">DNIT 141/2022-ES</td></tr>
  <tr><td>Imprimação CM-30 (1,2 L/m²)</td><td class="n">${nf(q.Aimp, 0)} m² · ${nf(q.Limp, 0)} L</td><td class="m">DNIT 144/2014-ES</td></tr>
  <tr><td>Pintura de ligação RR-1C (0,9 L/m² diluída)</td><td class="n">${nf(q.Apint, 0)} m² · ${nf(q.Lpint / 2, 0)} L de emulsão</td><td class="m">DNIT 145/2012-ES</td></tr>
  <tr><td>CBUQ faixa C-12,5, 5 cm</td><td class="n">${nf(q.Trv, 0)} t</td><td class="m">DNIT 031/2024-ES</td></tr>
  <tr><td>CAP 50/70 (5,6 %)</td><td class="n">${nf(q.Trv * 0.056, 1)} t</td><td class="m">DNIT 031/2024-ES</td></tr></tbody></table></div></div></div>
  <h3 class="h3">Seções transversais e volumes</h3><div class="tbl"><table><thead><tr><th>Est.</th><th class="n">Terreno (m)</th><th class="n">Greide (m)</th><th class="n">Terraplenagem (m)</th><th class="n">h corte/aterro (m)</th><th class="n">Área corte (m²)</th><th class="n">Área aterro (m²)</th><th class="n">V corte (m³)</th><th class="n">V aterro (m³)</th><th class="n">Acumulado (m³)</th></tr></thead><tbody>${rows}<tr class="tot"><td>Total</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="n">${nf(q.Vc, 0)}</td><td class="n">${nf(q.Va, 0)}</td><td></td></tr></tbody></table></div>`;
}
function secaoTipo() {
  const W = 460,
    H = 230,
    cx = 230,
    sc = 26; // m -> px horizontal
  const ys = { rv: 60, ba: 78, sb: 108, sg: 148 };
  const lay = (w, y0, y1, c, n, e) => {
    const h = (w / 2) * sc;
    return `<polygon points="${cx - h},${y1} ${cx},${y1 - 4} ${cx + h},${y1} ${cx + h},${y0} ${cx},${y0 - 4} ${cx - h},${y0}" fill="${c}" stroke="var(--panel)" stroke-width="1"/><text x="${cx + h + 8}" y="${(y0 + y1) / 2 + 4}" class="lt">${n}</text><text x="${cx - h - 8}" y="${(y0 + y1) / 2 + 4}" text-anchor="end" class="lt mono">${e}</text>`;
  };
  let s = `<svg viewBox="0 0 ${W + 120} ${H}" class="chart secao" role="img" aria-label="Seção-tipo do pavimento">`;
  s += `<polygon points="${cx - 4.5 * sc - 60},${H - 20} ${cx - 4.5 * sc},${ys.sg} ${cx + 4.5 * sc},${ys.sg} ${cx + 4.5 * sc + 60},${H - 20}" fill="#b5784a" opacity=".55"/>`;
  s += `<text x="${cx}" y="${H - 34}" text-anchor="middle" class="lt">Subleito regularizado (ISC 9 %)</text>`;
  s += lay(8.0, ys.sb, ys.sg, '#b79a72', 'Sub-base solo-brita', '20 cm');
  s += lay(7.6, ys.ba, ys.sb, '#9d9d97', 'Base brita graduada', '15 cm');
  s += `<line x1="${cx - 3.8 * sc}" x2="${cx + 3.8 * sc}" y1="${ys.ba - 0.5}" y2="${ys.ba - 0.5}" stroke="#5a3d26" stroke-width="2"/>`;
  s += lay(7.0, ys.rv, ys.ba, '#2e3133', 'CBUQ faixa C-12,5', '5 cm');
  s += `<text x="${cx}" y="${ys.rv - 18}" text-anchor="middle" class="lt">pista 7,00 m · 2 faixas de 3,50 m · i = 2 %</text>`;
  return s + '</svg>';
}

// ---------- contexto e normas ----------
function tabCtx() {
  const NN = [
    ['DNIT 104/2009-ES', 'Terraplenagem: serviços preliminares', 'Limpeza e destocamento'],
    ['DNIT 106/2009-ES', 'Terraplenagem: cortes', 'Escavação e transporte'],
    ['DNIT 108/2009-ES', 'Terraplenagem: aterros', 'Corpo e camada final'],
    ['DNIT 137/2010-ES', 'Regularização do subleito', 'Subleito'],
    ['DNIT 139/2010-ES', 'Sub-base estabilizada granulometricamente', 'Sub-base'],
    ['DNIT 141/2022-ES', 'Base estabilizada granulometricamente', 'Base'],
    ['DNIT 144/2014-ES', 'Imprimação com ligante asfáltico', 'Imprimação'],
    ['DNIT 145/2012-ES', 'Pintura de ligação com ligante asfáltico', 'Pintura'],
    ['DNIT 031/2024-ES', 'Concreto asfáltico', 'CBUQ, usina e aceitação'],
    ['DNER-ME 092/94', 'Massa específica in situ: frasco de areia', 'GC das camadas'],
    ['DNER-ME 129/94', 'Compactação (amostras não trabalhadas)', 'Referência de GC'],
    ['DNER-ME 049/94', 'Índice de Suporte Califórnia', 'Materiais'],
    ['DNIT 447-ME', 'Ensaio Marshall', 'Dosagem'],
    ['DNIT 133-ME', 'Deflexões com viga Benkelman', 'Aceitação'],
    ['DNER-PRO 277/97', 'Plano de amostragem e controle estatístico', 'Frequências']
  ];
  const flow = [
    'Execução da camada',
    'Ensaios de campo (laboratório)',
    'Análise do engenheiro residente',
    'Não conformidade? Retrabalho e reensaio',
    'Fiscalização assina o BLC',
    'Próxima camada liberada'
  ];
  return `<div class="pane-head"><h2>Contexto da obra militar</h2><p>${esc(OBRA.local)}. A via interna liga duas ruas existentes da Vila Militar e foi projetada para o tráfego de ${esc(OBRA.trafego)}.</p></div>
  <div class="flow">${flow.map((f, i) => `<div class="fstep${i === 3 ? ' warn' : ''}"><b>${i + 1}</b>${esc(f)}</div>`).join('<span class="farr">→</span>')}</div>
  <div class="masonry">${CONTEXTO.map(([t, x]) => `<div class="ccard"><h4>${esc(t)}</h4><p class="csub">${esc(x)}</p></div>`).join('')}</div>
  <h3 class="h3">Normas utilizadas</h3><div class="tbl"><table><thead><tr><th>Norma</th><th>Título</th><th>Aplicação no modelo</th></tr></thead><tbody>${NN.map(n => `<tr><td class="m">${n[0]}</td><td>${esc(n[1])}</td><td>${esc(n[2])}</td></tr>`).join('')}</tbody></table></div>
  <p class="note">Modelo didático. Terreno, quantidades e resultados de ensaio são ilustrativos, gerados de forma coerente com os critérios das especificações citadas. Não substituem o projeto executivo nem o plano de controle da obra real. Confirme sempre a revisão vigente de cada norma na coletânea do DNIT.</p>`;
}

function bindTab() {
  document.querySelectorAll('#pane [data-svc]').forEach(
    r =>
      (r.onclick = () => {
        ST.man = r.dataset.svc;
        const v = svcById(ST.man);
        goDay(v.a + 0.02);
        renderTab();
      })
  );
  document.querySelectorAll('#pane [data-man]').forEach(
    b =>
      (b.onclick = () => {
        ST.man = b.dataset.man;
        renderTab();
        const c = document.querySelector('.man-card');
        if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      })
  );
  document.querySelectorAll('#pane [data-goto]').forEach(
    b =>
      (b.onclick = () => {
        goDay(+b.dataset.goto + 0.02);
        document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
  );
  document.querySelectorAll('#pane tr[data-t]').forEach(
    r =>
      (r.onclick = () => {
        selectTest(
          TT.find(t => t.id === r.dataset.t),
          true
        );
        document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
  );
  if ($('fSvc')) {
    $('fSvc').onchange = filterReg;
    $('fSt').onchange = filterReg;
  }
  document.querySelectorAll('#pane [data-startgame]').forEach(
    b =>
      (b.onclick = () => {
        setMode('missao');
        document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
  );
  document.querySelectorAll('#pane [data-restart]').forEach(
    b =>
      (b.onclick = () => {
        resetGame();
        GAME.finished = false;
        if (!GAME.on) setMode('missao');
        else briefing();
        document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
  );
  const cp = $('dCopy');
  if (cp)
    cp.onclick = () => {
      const txt = diarioTexto();
      const ta = $('dTxt');
      const fall = () => {
        ta.hidden = false;
        ta.value = txt;
        ta.focus();
        ta.select();
        $('dMsg').textContent = 'Texto selecionado. Use Ctrl+C para copiar.';
      };
      try {
        navigator.clipboard.writeText(txt).then(() => {
          $('dMsg').textContent = 'Diário copiado.';
        }, fall);
      } catch (e) {
        fall();
      }
    };
  if ($('calc')) {
    $('calc')
      .querySelectorAll('input')
      .forEach(i => (i.oninput = calcFleet));
    calcFleet();
  }
}

// ---------- laço principal ----------
let clk = 0,
  lastT = performance.now(),
  lastTerrT = 0;
function tick(force) {
  const st = stateAt(ST.day);
  const now = performance.now();
  if (force || !ST.playing || now - lastTerrT > 110) {
    updateTerrain(st);
    lastTerrT = now;
  }
  updateSite(st);
  updatePavement(st);
  updateEquipment(st, clk);
  updateMarkers(st, clk);
  // rótulo da frente ativa
  const fp = frontPoint(st);
  if (fp && ST.lay.rotulos !== false) {
    const s = fp.s,
      z = fp.z || 0;
    ST.frontLbl.position.set(wx(s), wy(surfC(s, z, st)) + 7, z);
    ST.frontLbl.element.textContent = CURTO[fp.id] || fp.nome;
    ST.frontLbl.element.style.display = '';
    ST.frontLbl.visible = true;
  } else {
    ST.frontLbl.visible = false;
  }
  ST.labLbl.visible = !!ST.labPulse && ST.lay.rotulos !== false && !ST.profile;
  for (const L of labels) if (L.userData.site && L !== ST.labLbl) L.visible = ST.lay.rotulos !== false && !ST.profile;
  ST.labLbl.element.textContent = 'Ensaio em andamento';
  if (ST.follow && fp) {
    const tg = new THREE.Vector3(wx(fp.s), wy(surfC(fp.s, fp.z || 0, st)), fp.z || 0);
    const off = camera.position.clone().sub(controls.target);
    controls.target.lerp(tg, 0.08);
    camera.position.copy(controls.target).add(off);
  }
  updateUI(force);
}
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  if (ST.playing) {
    clk += dt;
    const nd = gameGate(Math.min(END, ST.day + dt * 0.45 * ST.speed));
    if (ST.playing) ST.day = nd;
    if (ST.day >= END && ST.playing) setPlaying(false);
  }
  if (camAnim) {
    camAnim.k = Math.min(1, camAnim.k + dt * 1.4);
    const e = camAnim.k < 0.5 ? 2 * camAnim.k * camAnim.k : 1 - Math.pow(-2 * camAnim.k + 2, 2) / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p, e);
    controls.target.lerpVectors(camAnim.t0, camAnim.t, e);
    if (camAnim.k >= 1) setCamAnim(null);
  }
  root.scale.y += (ST.vexag - root.scale.y) * 0.1;
  tick(false);
  controls.update();
  renderer.render(scene, camera);
  lr.render(scene, camera);
  requestAnimationFrame(loop);
}

function boot() {
  setQ(buildQuant());
  setObraQ(Q);
  liftExtents();
  rebuild();
  initScene();
  initUI();
  $('loading').hidden = true;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme();
    renderTab();
  });
  new MutationObserver(() => {
    applyTheme();
    renderTab();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const h = (location.hash || '').slice(1);
  if (h === 'missao') setMode('missao');
  else if (['sequencia', 'controle', 'laboratorio', 'usina', 'quantitativos', 'contexto', 'diario'].includes(h))
    openTab({ sequencia: 'seq', controle: 'ctrl', laboratorio: 'lab', usina: 'usina', quantitativos: 'quant', contexto: 'ctx', diario: 'diario' }[h]);
  requestAnimationFrame(loop);
}
window.addEventListener('DOMContentLoaded', () => {
  try {
    boot();
  } catch (e) {
    console.error(e);
    $('loading').innerHTML = 'Não foi possível montar o modelo<small>' + esc(e.message) + '</small>';
  }
});

// ---------- diário de obra ----------
const QTD_SVC = () => ({
  S04: [Q.Alimp, 'm²', 'limpeza'],
  S06: [Q.Vc, 'm³', 'escavação'],
  S07: [Q.Vcorpo, 'm³', 'aterro compactado'],
  S08: [Q.Vcf, 'm³', 'aterro compactado'],
  S09: [Q.Areg, 'm²', 'regularização'],
  S11: [Q.Vsb, 'm³', 'sub-base compactada'],
  S12: [Q.Vba, 'm³', 'base compactada'],
  S13: [Q.Aimp, 'm²', 'imprimação'],
  S14: [Q.Apint, 'm²', 'pintura'],
  S15: [Q.Trv, 't', 'CBUQ aplicado'],
  R1: [11.4, 'm³', 'base retrabalhada'],
  R2: [12, 't', 'CBUQ fresado e refeito']
});
function diarioData() {
  const d = ST.day,
    D = Math.floor(Math.min(d, END - 1e-6)),
    a = D,
    b = Math.min(D + 1, d);
  const qs = QTD_SVC();
  const svcs = [];
  let efet = 0;
  const eq = {};
  for (const s of SVC) {
    const ws = s.win ? s.win : Object.values(s.lanes);
    let frac = 0,
      fracAc = 0,
      ativo = false;
    for (const w of ws) {
      const L = w[1] - w[0];
      const ov = Math.max(0, Math.min(b, w[1]) - Math.max(a, w[0]));
      if (ov > 0) ativo = true;
      frac += ov / L / ws.length;
      fracAc += clamp((d - w[0]) / L, 0, 1) / ws.length;
    }
    const cura = s.cura && Math.min(b, s.cura[1]) > Math.max(a, s.cura[0]);
    if (!ativo && !cura) continue;
    const q = qs[s.id];
    svcs.push({
      s,
      frac,
      fracAc,
      cura: cura && !ativo,
      txt:
        q && ativo
          ? `${nf(q[0] * frac, 0)} ${q[1]} de ${q[2]} no dia · ${Math.round(fracAc * 100)} % acumulado`
          : cura && !ativo
            ? 'Imprimação em cura, faixa interditada'
            : `${Math.round(fracAc * 100)} % concluído`
    });
    if (ativo) {
      efet += (s.efetivo.match(/\d+/g) || []).reduce((x, y) => x + +y, 0);
      s.eq.forEach(([n, k]) => (eq[n] = Math.max(eq[n] || 0, k)));
    }
  }
  const ens = TT.filter(t => t.day >= a && t.day <= b);
  const libs = GATES.filter(g => g.day >= a && g.day <= b + 1e-6 && d >= g.day);
  const oc = [];
  ens.filter(t => !t.ok).forEach(t => oc.push(`Não conformidade: ${t.nome} = ${t.v} ${t.u} (critério ${t.crit}). ${t.obs || ''}`.trim()));
  if (typeof GAME !== 'undefined' && GAME.on) {
    for (const k in GAME.done) {
      const r = GAME.done[k];
      if (r.day >= a && r.day <= b) {
        const dc = DECISOES.find(x => x.id === k);
        oc.push(`Decisão do engenheiro residente (${dc.titulo}): ${r.op.t}`);
      }
    }
    GAME.events.filter(e => e.seen && e.day >= a && e.day <= b).forEach(e => oc.push(`${e.titulo}: ${e.txt}`));
  }
  const chuva = typeof GAME !== 'undefined' && GAME.on && GAME.done.D4 && Math.floor(DECISOES.find(x => x.id === 'D4').day()) === D;
  return {
    D,
    d,
    parcial: d < D + 1 - 1e-6 && d < END - 1e-6,
    svcs,
    efet,
    eq,
    ens,
    libs,
    oc,
    tempo: chuva
      ? 'Manhã e tarde com tempo bom; frente fria com chuva forte prevista para a noite.'
      : 'Tempo bom, sem chuva. Condição compatível com a execução de todos os serviços.'
  };
}
function tabDiario() {
  const x = diarioData();
  return `<div class="pane-head"><h2>Diário de obra</h2><p>Gerado a partir do dia exibido no modelo: serviços, quantidades, efetivo, equipamentos, ensaios, liberações e ocorrências. Avance a obra para preencher o dia seguinte.</p></div>
  <article class="diario"><header><div><h3>Diário de obra nº ${String(x.D + 1).padStart(3, '0')}</h3><div class="m">${esc(OBRA.titulo)} · ${esc(OBRA.local)}</div></div><div class="m">${fmtDate(x.D)}${x.parcial ? ` · parcial até ${fmtHour(x.d)}` : ''}<br>Efetivo no dia: ${x.efet} militares</div></header>
  <section><h4>Condições do tempo</h4><ul><li>${esc(x.tempo)}</li></ul></section>
  <section><h4>Serviços executados</h4><ul>${x.svcs.length ? x.svcs.map(v => `<li><b>${v.s.id}</b> ${esc(v.s.nome)}: ${esc(v.txt)}</li>`).join('') : '<li>Sem frente de serviço neste dia.</li>'}</ul></section>
  <section><h4>Equipamentos em operação</h4><ul>${
    Object.keys(x.eq).length
      ? Object.entries(x.eq)
          .map(([n, k]) => `<li>${k}× ${esc(n)}</li>`)
          .join('')
      : '<li>Nenhum.</li>'
  }</ul></section>
  <section><h4>Ensaios realizados</h4><ul>${x.ens.length ? x.ens.map(t => `<li><span class="${t.ok ? 'ok' : 'bad'}">${t.ok ? 'Conforme' : 'Não conforme'}</span> · ${esc(t.nome)}${t.s != null ? ` (est. ${estStr(t.s)})` : ''}: ${esc(t.v)} ${esc(t.u)}</li>`).join('') : '<li>Nenhum ensaio no dia.</li>'}</ul></section>
  <section><h4>Liberações de camada</h4><ul>${x.libs.length ? x.libs.map(g => `<li>${g.id} · ${esc(g.nome)} emitido</li>`).join('') : '<li>Nenhuma liberação no dia.</li>'}</ul></section>
  <section><h4>Ocorrências</h4><ul>${x.oc.length ? x.oc.map(o => `<li>${esc(o)}</li>`).join('') : '<li>Sem ocorrências.</li>'}</ul></section>
  <div class="sig"><div>Engenheiro residente</div><div>Fiscalização</div></div></article>
  <div class="gm-act"><button class="btn" id="dCopy">Copiar o diário</button><span class="csub" id="dMsg" aria-live="polite"></span></div><textarea id="dTxt" hidden readonly aria-label="Texto do diário"></textarea>`;
}
function diarioTexto() {
  const x = diarioData();
  const L = [];
  L.push(
    `DIÁRIO DE OBRA Nº ${String(x.D + 1).padStart(3, '0')} · ${fmtDate(x.D)}${x.parcial ? ' (parcial até ' + fmtHour(x.d) + ')' : ''}`,
    `${OBRA.titulo} · ${OBRA.local}`,
    `Efetivo: ${x.efet} militares`,
    '',
    'CONDIÇÕES DO TEMPO',
    x.tempo,
    '',
    'SERVIÇOS EXECUTADOS'
  );
  x.svcs.forEach(v => L.push(`- ${v.s.id} ${v.s.nome}: ${v.txt}`));
  if (!x.svcs.length) L.push('- Sem frente de serviço.');
  L.push('', 'EQUIPAMENTOS');
  Object.entries(x.eq).forEach(([n, k]) => L.push(`- ${k}x ${n}`));
  L.push('', 'ENSAIOS');
  x.ens.forEach(t => L.push(`- ${t.ok ? 'Conforme' : 'NÃO CONFORME'}: ${t.nome}${t.s != null ? ' (est. ' + estStr(t.s) + ')' : ''} = ${t.v} ${t.u}`));
  if (!x.ens.length) L.push('- Nenhum.');
  L.push('', 'LIBERAÇÕES');
  x.libs.forEach(g => L.push(`- ${g.id} ${g.nome} emitido`));
  if (!x.libs.length) L.push('- Nenhuma.');
  L.push('', 'OCORRÊNCIAS');
  x.oc.forEach(o => L.push('- ' + o));
  if (!x.oc.length) L.push('- Sem ocorrências.');
  L.push('', 'Engenheiro residente: ____________________   Fiscalização: ____________________');
  return L.join('\n');
}

export {
  $,
  esc,
  svcById,
  pct,
  GATES,
  gateDays,
  gateStatus,
  initUI,
  rebuildAll,
  setPlaying,
  goDay,
  syncSpeed,
  openTab,
  svcStarts,
  jumpSvc,
  renderGates,
  updateGates,
  activeList,
  lastUI,
  updateUI,
  showInfo,
  hideInfo,
  selectTest,
  renderTab,
  GX,
  tabSeq,
  CURTO,
  manualHTML,
  PLANO,
  tabCtrl,
  filterReg,
  chart,
  card,
  lg,
  tabLab,
  tabUsina,
  calcFleet,
  tabQuant,
  secaoTipo,
  tabCtx,
  bindTab,
  clk,
  lastT,
  lastTerrT,
  tick,
  loop,
  boot,
  QTD_SVC,
  diarioData,
  tabDiario,
  diarioTexto
};
