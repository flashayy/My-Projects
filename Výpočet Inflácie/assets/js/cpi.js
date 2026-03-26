/* ── cpi.js — CPI Calculator logic ──────────────────────────── */

// ── Historical HICP data (Slovakia, 2015 = 100, Eurostat) ─────
const CPI_DATA = {
  2000: 61.2,  2001: 65.8,  2002: 68.5,  2003: 71.9,  2004: 76.4,
  2005: 79.6,  2006: 82.1,  2007: 85.3,  2008: 90.2,  2009: 91.3,
  2010: 93.5,  2011: 97.2,  2012: 100.5, 2013: 101.4, 2014: 100.9,
  2015: 100.0, 2016: 99.7,  2017: 101.3, 2018: 103.8, 2019: 105.7,
  2020: 106.2, 2021: 109.8, 2022: 122.4, 2023: 133.1, 2024: 137.2,
};

// ── Basket items with category-specific CPI multipliers ───────
const BASKET_ITEMS = [
  { id: 'chlieb',   name: 'Chlieb',        icon: '🍞', defaultPrice: 1.20,  cpiWeight: 1.10 },
  { id: 'mleko',    name: 'Mlieko (1L)',    icon: '🥛', defaultPrice: 0.85,  cpiWeight: 1.15 },
  { id: 'vajcia',   name: 'Vajcia (10ks)',  icon: '🥚', defaultPrice: 2.20,  cpiWeight: 1.20 },
  { id: 'maslo',    name: 'Maslo (250g)',   icon: '🧈', defaultPrice: 2.50,  cpiWeight: 1.18 },
  { id: 'benzin',   name: 'Benzín (1L)',    icon: '⛽', defaultPrice: 1.35,  cpiWeight: 1.25 },
  { id: 'elektrina',name: 'Elektrina/mes.', icon: '⚡', defaultPrice: 45.00, cpiWeight: 1.35 },
  { id: 'kavicka',  name: 'Káva (reštaurácia)', icon: '☕', defaultPrice: 1.80, cpiWeight: 1.12 },
  { id: 'lekar',    name: 'Lekársky poplatok', icon: '🏥', defaultPrice: 5.00, cpiWeight: 1.08 },
];

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('sk-SK', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);

const fmtPct  = (n, plus = false) => (plus && n > 0 ? '+' : '') + n.toFixed(2) + ' %';
const fmtMult = (n) => n.toFixed(3) + '×';
const years   = Object.keys(CPI_DATA).map(Number);

// ── Animate number ────────────────────────────────────────────
function animNum(el, to, formatter) {
  const dur = 550, start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = formatter(to * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Populate selects ──────────────────────────────────────────
function populateSelect(id, defaultYear) {
  const sel = document.getElementById(id);
  if (!sel) return;
  years.forEach((y) => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === defaultYear) opt.selected = true;
    sel.appendChild(opt);
  });
}

populateSelect('cmpFrom', 2015);
populateSelect('cmpTo',   2024);
populateSelect('bsktFrom', 2015);
populateSelect('bsktTo',   2024);

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ── Chart instance ────────────────────────────────────────────
let cpiChartInst = null;

function loadChartJS(cb) {
  if (window.Chart) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  s.onload = cb;
  document.head.appendChild(s);
}

// ════════════════════════════════════════════════════════════════
// TAB 1 — Compare years
// ════════════════════════════════════════════════════════════════
document.getElementById('cmpCalcBtn').addEventListener('click', () => {
  const amount = parseFloat(document.getElementById('cmpAmount').value);
  const from   = parseInt(document.getElementById('cmpFrom').value);
  const to     = parseInt(document.getElementById('cmpTo').value);

  if (isNaN(amount) || amount <= 0) { shake(document.getElementById('cmpAmount')); return; }
  if (from === to) { alert('Zvoľte rôzne roky.'); return; }

  const cpiFrom = CPI_DATA[from];
  const cpiTo   = CPI_DATA[to];
  const factor  = cpiTo / cpiFrom;
  const adjusted = amount * factor;
  const cpiChange = ((cpiTo - cpiFrom) / cpiFrom) * 100;
  const diff = adjusted - amount;

  // Show results
  showResults('cmpResults');

  animNum(document.getElementById('cmpEquivalent'), adjusted, fmt);
  animNum(document.getElementById('cmpCpiChange'),  cpiChange, (v) => fmtPct(v, true));
  animNum(document.getElementById('cmpRealDiff'),   Math.abs(diff), (v) => (diff >= 0 ? '+' : '−') + fmt(v));

  document.getElementById('cmpSubLabel').textContent =
    `${from} → ${to} (faktor ${factor.toFixed(3)}×)`;

  renderTimeline(from, to, cpiFrom, cpiTo, amount, adjusted);
  loadChartJS(() => renderCpiChart(from, to));
});

function renderTimeline(from, to, cpiFrom, cpiTo, amount, adjusted) {
  const el = document.getElementById('cpiTimeline');
  const allYears = years.filter((y) => y >= from && y <= to);

  // Build intermediate nodes (max 5 visible)
  const step = Math.ceil(allYears.length / 5);
  const nodes = allYears.filter((_, i) => i % step === 0 || allYears[i] === to);

  const cpiChange = (((cpiTo - cpiFrom) / cpiFrom) * 100).toFixed(1);

  el.innerHTML = `
    <div class="timeline-title">Priebeh CPI od ${from} do ${to}</div>
    <div class="timeline-track" id="tlTrack"></div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:0.75rem;color:var(--muted)">
      <span>${fmt(amount)} <em style="opacity:.6">pôvodná suma</em></span>
      <span style="color:var(--accent);font-weight:500">CPI +${cpiChange}% → ${fmt(adjusted)}</span>
    </div>`;

  const track = document.getElementById('tlTrack');

  nodes.forEach((y, i) => {
    const isFrom = y === from;
    const isTo   = y === to;
    const cls    = isFrom ? 'from' : isTo ? 'to' : '';
    const cpi    = CPI_DATA[y];

    const node = document.createElement('div');
    node.className = 'timeline-node';
    node.innerHTML = `
      <div class="timeline-dot ${cls}">${y}</div>
      <div class="timeline-node-label">
        <strong>CPI ${cpi}</strong>
      </div>`;
    track.appendChild(node);

    if (i < nodes.length - 1) {
      const line = document.createElement('div');
      line.className = 'timeline-line filled';
      if (i === 0) {
        const span = nodes[nodes.length - 1] - nodes[0];
        const midPct = ((nodes[Math.floor(nodes.length / 2)] - nodes[0]) / span * 100).toFixed(0);
        line.innerHTML = `<span class="timeline-arrow-label">+${(((CPI_DATA[nodes[Math.floor(nodes.length/2)]] - cpiFrom)/cpiFrom)*100).toFixed(1)}%</span>`;
      }
      track.appendChild(line);
    }
  });
}

function renderCpiChart(fromYear, toYear) {
  if (cpiChartInst) { cpiChartInst.destroy(); cpiChartInst = null; }

  const ctx = document.getElementById('cpiChart').getContext('2d');
  const labels = years.map(String);
  const data   = years.map((y) => CPI_DATA[y]);
  const ptColors = years.map((y) =>
    y === fromYear ? '#1a1917' : y === toYear ? '#c8692a' : 'rgba(0,0,0,0)'
  );
  const ptRadius = years.map((y) =>
    y === fromYear || y === toYear ? 7 : 3
  );

  cpiChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'CPI Index',
        data,
        borderColor: '#1a1917',
        backgroundColor: 'rgba(26,25,23,0.06)',
        borderWidth: 2.5,
        pointBackgroundColor: ptColors,
        pointRadius: ptRadius,
        pointHoverRadius: 8,
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1917',
          titleColor: 'rgba(255,255,255,0.55)',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: "'DM Sans', sans-serif", size: 11 },
          bodyFont: { family: "'DM Sans', sans-serif", size: 13, weight: '500' },
          callbacks: {
            label: (ctx) => `  CPI: ${ctx.parsed.y.toFixed(1)}`,
          },
        },
        annotation: {},
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
          ticks: { color: '#7a786f', font: { family: "'DM Sans', sans-serif", size: 11 } },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
          ticks: { color: '#7a786f', font: { family: "'DM Sans', sans-serif", size: 11 } },
          border: { display: false },
        },
      },
    },
  });
}

// ════════════════════════════════════════════════════════════════
// TAB 2 — Custom CPI
// ════════════════════════════════════════════════════════════════
document.getElementById('custCalcBtn').addEventListener('click', () => {
  const amount  = parseFloat(document.getElementById('custAmount').value);
  const cpiFrom = parseFloat(document.getElementById('custCpiFrom').value);
  const cpiTo   = parseFloat(document.getElementById('custCpiTo').value);

  if (isNaN(amount) || amount <= 0)  { shake(document.getElementById('custAmount')); return; }
  if (isNaN(cpiFrom) || cpiFrom <= 0){ shake(document.getElementById('custCpiFrom')); return; }
  if (isNaN(cpiTo)   || cpiTo <= 0)  { shake(document.getElementById('custCpiTo'));   return; }

  const factor   = cpiTo / cpiFrom;
  const adjusted = amount * factor;
  const changePct = (factor - 1) * 100;

  showResults('custResults');

  animNum(document.getElementById('custAdjusted'), adjusted, fmt);
  animNum(document.getElementById('custFactor'),   factor,   fmtMult);
  animNum(document.getElementById('custChange'),   Math.abs(changePct), (v) => (changePct >= 0 ? '+' : '−') + v.toFixed(2) + ' %');

  // Gauge: map factor 0.5–2.5 to 0–100%
  const pct = Math.min(100, Math.max(0, ((factor - 0.5) / 2.0) * 100));
  setTimeout(() => {
    document.getElementById('gaugeFill').style.width   = pct + '%';
    document.getElementById('gaugeMarker').style.left  = pct + '%';
  }, 80);
});

// ════════════════════════════════════════════════════════════════
// TAB 3 — Basket
// ════════════════════════════════════════════════════════════════
function buildBasket() {
  const grid = document.getElementById('basketGrid');
  grid.innerHTML = '';
  BASKET_ITEMS.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'basket-item';
    div.innerHTML = `
      <div class="basket-item-header">
        <span class="basket-icon">${item.icon}</span>
        <span class="basket-name">${item.name}</span>
      </div>
      <div class="input-wrapper">
        <input type="number" id="bskt_${item.id}" placeholder="${item.defaultPrice.toFixed(2)}"
               value="${item.defaultPrice.toFixed(2)}" min="0" step="0.01"/>
        <span class="input-unit">€</span>
      </div>`;
    grid.appendChild(div);
  });
}

buildBasket();

document.getElementById('bsktCalcBtn').addEventListener('click', () => {
  const from = parseInt(document.getElementById('bsktFrom').value);
  const to   = parseInt(document.getElementById('bsktTo').value);

  if (from === to) { alert('Zvoľte rôzne roky.'); return; }

  const cpiFrom = CPI_DATA[from];
  const cpiTo   = CPI_DATA[to];

  let totalFrom = 0, totalTo = 0;
  const resultCards = [];

  BASKET_ITEMS.forEach((item) => {
    const priceFrom = parseFloat(document.getElementById('bskt_' + item.id).value) || item.defaultPrice;
    const factor    = (cpiTo / cpiFrom) * item.cpiWeight;
    const priceTo   = priceFrom * (cpiTo / cpiFrom); // use plain CPI ratio for total
    totalFrom += priceFrom;
    totalTo   += priceTo;
    const pct = ((priceTo - priceFrom) / priceFrom) * 100;
    resultCards.push({ item, priceFrom, priceTo, pct });
  });

  showResults('bsktResults');

  // Render cards
  const rGrid = document.getElementById('basketResultsGrid');
  rGrid.innerHTML = '';
  resultCards.forEach(({ item, priceFrom, priceTo, pct }, i) => {
    const card = document.createElement('div');
    card.className = 'basket-result-card';
    card.style.animationDelay = (i * 0.04) + 's';
    card.innerHTML = `
      <div class="br-header">
        <span class="br-icon">${item.icon}</span>
        <span class="br-name">${item.name}</span>
      </div>
      <div class="br-values">
        <span class="br-from">${fmt(priceFrom)}</span>
        <span class="br-arrow">→</span>
        <span class="br-to">${fmt(priceTo)}</span>
      </div>
      <span class="br-pct ${pct <= 0 ? 'positive' : ''}">${fmtPct(pct, true)}</span>`;
    rGrid.appendChild(card);
  });

  const totalPct = ((totalTo - totalFrom) / totalFrom) * 100;

  animNum(document.getElementById('bsktTotalFrom'), totalFrom, fmt);
  animNum(document.getElementById('bsktTotalTo'),   totalTo,   fmt);
  animNum(document.getElementById('bsktTotalPct'),  Math.abs(totalPct), (v) => (totalPct >= 0 ? '+' : '−') + v.toFixed(2) + ' %');

  document.getElementById('bsktFromLabel').textContent = from;
  document.getElementById('bsktToLabel').textContent   = to;
});

// ════════════════════════════════════════════════════════════════
// Reference table
// ════════════════════════════════════════════════════════════════
function buildRefGrid() {
  const grid = document.getElementById('refGrid');
  years.forEach((y, i) => {
    const cpi  = CPI_DATA[y];
    const prev = i > 0 ? CPI_DATA[years[i - 1]] : null;
    const diff = prev ? ((cpi - prev) / prev * 100) : null;
    const cls  = diff === null ? 'neu' : diff > 0 ? 'up' : diff < 0 ? 'down' : 'neu';
    const sign = diff === null ? '' : diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '';

    const cell = document.createElement('div');
    cell.className = 'ref-cell';
    cell.innerHTML = `
      <div class="ref-year">${y}</div>
      <div class="ref-cpi">${cpi.toFixed(1)}</div>
      ${diff !== null ? `<div class="ref-change ${cls}">${sign}${Math.abs(diff).toFixed(1)}%</div>` : ''}`;
    grid.appendChild(cell);
  });
}

buildRefGrid();

// ── Shared utilities ──────────────────────────────────────────
function showResults(id) {
  const el = document.getElementById(id);
  el.classList.remove('visible');
  void el.offsetWidth;
  el.classList.add('visible');
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
}

function shake(el) {
  el.animate(
    [{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' },
     { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' },
     { transform: 'translateX(0)' }],
    { duration: 350 }
  );
  el.focus();
  el.style.borderColor = '#c8692a';
  setTimeout(() => (el.style.borderColor = ''), 900);
}