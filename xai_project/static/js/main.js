/* ═══════════════════════════════════════════════════════
   XAI · IT Decision Support v3.0 — Frontend JS
   ═══════════════════════════════════════════════════════ */

// ── Conversion thresholds (mirrors backend) ──────────────
const CONV = {
  budget:   { low: 300000, high: 700000, unit: '$', prefix: true },
  risk:     { low: 3,      high: 6,      unit: '/10', prefix: false },
  profit:   { low: 20,     high: 50,     unit: '%',   prefix: false },
  duration: { low: 6,      high: 12,     unit: ' mo', prefix: false },
};

function getCategory(field, val) {
  const t = CONV[field];
  if (!t) return null;
  if (field === 'duration') {
    return val <= t.low ? 'Short' : val <= t.high ? 'Medium' : 'Long';
  }
  return val < t.low ? 'Low' : val < t.high ? 'Medium' : 'High';
}

function getCatClass(cat) {
  if (cat === 'Low'  || cat === 'Short') return 'low';
  if (cat === 'Medium')                  return 'mid';
  return 'high';
}

// ── Live field updates ────────────────────────────────────
function onFieldChange(field) {
  const input = document.getElementById(`f-${field}`);
  const badge = document.getElementById(`badge-${field}`);
  const val   = parseFloat(input.value);

  if (isNaN(val) || input.value === '') {
    badge.textContent = '—';
    badge.className   = 'field-badge';
    if (field === 'risk') updateRiskBar(0);
    updateSummary();
    return;
  }

  const cat     = getCategory(field, val);
  const cls     = getCatClass(cat);
  badge.textContent = cat;
  badge.className   = `field-badge ${cls}`;

  if (field === 'risk') updateRiskBar(val);
  updateSummary();
}

function updateRiskBar(val) {
  const fill = document.getElementById('rs-fill');
  if (!fill) return;
  const pct = Math.min(Math.max((val - 1) / 9, 0), 1) * 100;
  const color = val <= 3 ? '#0ecf8a' : val <= 6 ? '#f5a623' : '#f0445f';
  fill.style.width      = pct + '%';
  fill.style.background = color;
}

function updateSummary() {
  const fields = ['budget','risk','profit','duration'];
  const vals   = fields.map(f => parseFloat(document.getElementById(`f-${f}`)?.value));
  const allFilled = vals.every(v => !isNaN(v));
  const summary   = document.getElementById('input-summary');
  const grid      = document.getElementById('is-grid');
  if (!summary || !grid) return;

  if (!allFilled) { summary.style.display = 'none'; return; }
  summary.style.display = 'block';

  const labels   = ['Budget','Risk Level','Exp. Profit','Duration'];
  const displays = [
    `$${Number(vals[0]).toLocaleString()}`,
    `${vals[1]}/10`,
    `${vals[2]}%`,
    `${vals[3]} months`,
  ];
  const cats     = fields.map((f,i) => getCategory(f, vals[i]));

  grid.innerHTML = fields.map((f,i) => `
    <div class="is-row">
      <div class="is-label">${labels[i]}</div>
      <div class="is-val">${displays[i]}</div>
      <div class="is-cat ${getCatClass(cats[i])}">${cats[i]}</div>
    </div>
  `).join('');
}

// ── Run Decision ──────────────────────────────────────────
async function runDecision() {
  const fields   = ['budget','risk','profit','duration'];
  const vals     = fields.map(f => document.getElementById(`f-${f}`)?.value?.trim());
  const missing  = fields.filter((f,i) => !vals[i] || isNaN(parseFloat(vals[i])));

  if (missing.length > 0) {
    showError(`Please fill in: ${missing.map(f => f.charAt(0).toUpperCase()+f.slice(1)).join(', ')}`);
    return;
  }

  const btn   = document.getElementById('run-btn');
  const idle  = document.getElementById('rb-idle');
  const busy  = document.getElementById('rb-busy');
  btn.disabled  = true;
  idle.style.display = 'none';
  busy.style.display = 'flex';

  try {
    const res  = await fetch('/predict', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        budget:   parseFloat(vals[0]),
        risk:     parseFloat(vals[1]),
        profit:   parseFloat(vals[2]),
        duration: parseFloat(vals[3]),
      }),
    });
    const data = await res.json();

    if (!data.success) { showError(data.error || 'Prediction failed.'); return; }

    await new Promise(r => setTimeout(r, 420));  // brief humanizing pause
    renderResult(data);

  } catch (err) {
    showError('Network error: ' + err.message);
  } finally {
    btn.disabled  = false;
    idle.style.display = 'flex';
    busy.style.display = 'none';
  }
}

function showError(msg) {
  alert('⚠ ' + msg);
}

// ── Render Full Result ────────────────────────────────────
function renderResult(data) {
  document.getElementById('placeholder-card').style.display = 'none';
  const rb = document.getElementById('result-block');
  rb.style.display = 'block';
  rb.classList.remove('anim-in');
  void rb.offsetWidth;
  rb.classList.add('anim-in');

  renderDecision(data);
  renderConversion(data.conversion);
  renderPath(data.path);
  renderSHAP(data.shap);

  if (window.innerWidth < 1060) {
    rb.scrollIntoView({ behavior:'smooth', block:'start' });
  }
}

// ── 1. Decision Banner ────────────────────────────────────
function renderDecision(data) {
  const dec   = data.decision;
  const cls   = dec.toLowerCase();
  const card  = document.getElementById('decision-card');

  // top bar colour
  const borderMap = { Approve:'#0ecf8a', Review:'#f5a623', Reject:'#f0445f' };
  card.style.borderTop = `3px solid ${borderMap[dec] || 'var(--border)'}`;

  const badge = document.getElementById('dcv-badge');
  badge.textContent = dec.toUpperCase();
  badge.className   = `dcv-badge ${cls}`;

  const confMap = {
    Approve: `✅ Confidence ${data.confidence}% — Recommended for approval`,
    Review:  `🔍 Confidence ${data.confidence}% — Requires further evaluation`,
    Reject:  `❌ Confidence ${data.confidence}% — Not recommended`,
  };
  document.getElementById('dcv-sub').textContent       = confMap[dec] || '';
  document.getElementById('dc-explanation').textContent = data.explanation;

  // Probability bars
  const bars = document.getElementById('proba-bars');
  bars.innerHTML = ['Approve','Review','Reject'].map(label => {
    const pct = data.probabilities[label] ?? 0;
    return `
      <div class="pb-row">
        <div class="pb-header">
          <span class="pb-name">${label}</span>
          <span class="pb-val">${pct}%</span>
        </div>
        <div class="pb-track">
          <div class="pb-fill ${label.toLowerCase()}" data-w="${pct}%" style="width:0%"></div>
        </div>
      </div>`;
  }).join('');

  raf2(() => {
    bars.querySelectorAll('.pb-fill').forEach(el => el.style.width = el.dataset.w);
  });
}

// ── 2. Conversion Table ───────────────────────────────────
function renderConversion(conv) {
  const features = [
    { key:'budget',   label:'Budget',        icon:'💰' },
    { key:'risk',     label:'Risk Level',    icon:'⚠️' },
    { key:'profit',   label:'Exp. Profit',   icon:'📈' },
    { key:'duration', label:'Duration',      icon:'🗓' },
  ];
  const grid = document.getElementById('conv-grid');
  grid.innerHTML = features.map(({ key, label, icon }) => {
    const c   = conv[key];
    const cls = getCatClass(c.category);
    return `
      <div class="conv-item">
        <div class="ci-feature">${icon} ${label}</div>
        <div class="ci-raw">${c.raw}</div>
        <div class="ci-arrow">↓</div>
        <div class="ci-cat ${cls}">${c.category}</div>
        <div class="ci-rule">${c.rule}</div>
      </div>`;
  }).join('');
}

// ── 3. Decision Path ──────────────────────────────────────
function renderPath(path) {
  const depthNames = ['Root','Level 1','Level 2','Level 3','Level 4','Leaf'];
  const body       = document.getElementById('path-body');

  body.innerHTML = path.map((step, i) => {
    let cirCls, cirSym, statusCls, statusTxt;

    if (step.type === 'leaf') {
      cirCls    = 'leaf';  cirSym = '★';
      statusCls = 'leaf';  statusTxt = '→ Leaf: ' + step.condition;
    } else if (step.passed) {
      cirCls    = 'pass';  cirSym = '✓';
      statusCls = 'pass';  statusTxt = '→ Condition satisfied, proceed left';
    } else {
      cirCls    = 'fail';  cirSym = '✗';
      statusCls = 'fail';  statusTxt = '→ Condition failed, proceed right';
    }

    const depth = depthNames[step.depth] || `Depth ${step.depth}`;
    const samplesNote = step.type !== 'leaf' ? `<div class="ps-samples">${step.samples} training samples at this node</div>` : '';

    return `
      <div class="path-step">
        <div class="ps-circle ${cirCls}">${cirSym}</div>
        <div class="ps-body">
          <div class="ps-depth">${depth} · Node ${i+1}</div>
          <div class="ps-feature">${step.feature}</div>
          ${step.type !== 'leaf' ? `<div class="ps-condition">${step.condition}</div>` : ''}
          <div class="ps-status ${statusCls}">${statusTxt}</div>
          ${samplesNote}
        </div>
      </div>`;
  }).join('');
}

// ── 4. SHAP Chart ─────────────────────────────────────────
function renderSHAP(shapData) {
  const maxAbs = Math.max(...shapData.map(d => Math.abs(d.value)), 0.001);
  const body   = document.getElementById('shap-body');

  body.innerHTML = shapData.map(item => {
    const pct     = Math.abs(item.value) / maxAbs * 100;
    const isPos   = item.value > 0.01;
    const isNeg   = item.value < -0.01;
    const cls     = isPos ? 'pos' : isNeg ? 'neg' : 'neu';
    const sign    = isPos ? '+' : '';
    const valStr  = sign + (item.value * 100).toFixed(1) + '%';
    const clrCls  = isPos ? 'pos' : isNeg ? 'neg' : 'neu';
    const dispVal = pct > 12 ? valStr : '';

    return `
      <div class="shap-row">
        <div class="shap-top">
          <span class="shap-feat-name">${item.feature}</span>
          <span class="shap-pct ${clrCls}">${valStr}</span>
        </div>
        <div class="shap-track">
          <div class="shap-fill ${cls}" data-target="${pct}%" style="width:0%">${dispVal}</div>
        </div>
        <div class="shap-raw">Normalised Shapley contribution: ${(item.value*100).toFixed(1)}%</div>
      </div>`;
  }).join('');

  raf2(() => {
    body.querySelectorAll('.shap-fill').forEach(el => el.style.width = el.dataset.target);
  });
}

// ── Utility ───────────────────────────────────────────────
function raf2(fn) {
  requestAnimationFrame(() => requestAnimationFrame(fn));
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Enter key submits
  ['f-budget','f-risk','f-profit','f-duration'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') runDecision(); });
  });
});
