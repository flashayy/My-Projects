/* ── Inflation Calculator – script.js ────────────────────── */

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('sk-SK', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtPct = (n) => n.toFixed(2) + ' %';

// ── DOM refs ──────────────────────────────────────────────────
const amountInput  = document.getElementById('amount');
const rateInput    = document.getElementById('rate');
const yearsInput   = document.getElementById('years');
const rateSlider   = document.getElementById('rateSlider');
const sliderValue  = document.getElementById('sliderValue');
const calcBtn      = document.getElementById('calcBtn');
const resultsEl    = document.getElementById('results');

const futureValueEl = document.getElementById('futureValue');
const realValueEl   = document.getElementById('realValue');
const lossValueEl   = document.getElementById('lossValue');
const tableBody     = document.getElementById('tableBody');

let chartInstance = null;

// ── Sync slider ↔ rate input ──────────────────────────────────
rateSlider.addEventListener('input', () => {
  rateInput.value  = rateSlider.value;
  sliderValue.textContent = parseFloat(rateSlider.value).toFixed(1) + ' %';
});

rateInput.addEventListener('input', () => {
  const v = Math.min(20, Math.max(0, parseFloat(rateInput.value) || 0));
  rateSlider.value        = v;
  sliderValue.textContent = v.toFixed(1) + ' %';
});

// ── Core calculation ──────────────────────────────────────────
/**
 * Returns an array of yearly snapshots.
 * realValue[t] = amount / (1 + rate)^t
 * (The nominal amount stays the same – you hold it in cash.
 *  Its purchasing power erodes each year.)
 */
function calcInflation(amount, rate, years) {
  const r = rate / 100;
  const rows = [];
  for (let t = 0; t <= years; t++) {
    const real = amount / Math.pow(1 + r, t);
    const loss = ((amount - real) / amount) * 100;
    rows.push({ year: t, nominal: amount, real, loss });
  }
  return rows;
}

// ── Render table ──────────────────────────────────────────────
function renderTable(rows) {
  tableBody.innerHTML = rows
    .map((r) =>
      `<tr>
        <td>${r.year === 0 ? 'Dnes' : 'Rok ' + r.year}</td>
        <td>${fmt(r.nominal)}</td>
        <td>${fmt(r.real)}</td>
        <td class="loss-cell">${r.year === 0 ? '—' : fmtPct(r.loss)}</td>
       </tr>`
    )
    .join('');
}

// ── Render chart ──────────────────────────────────────────────
function renderChart(rows) {
  const ctx = document.getElementById('inflationChart').getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const labels   = rows.map((r) => (r.year === 0 ? 'Dnes' : 'R' + r.year));
  const nominals = rows.map((r) => parseFloat(r.nominal.toFixed(2)));
  const reals    = rows.map((r) => parseFloat(r.real.toFixed(2)));

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Nominálna',
          data: nominals,
          borderColor: '#1a1917',
          backgroundColor: 'rgba(26,25,23,0.06)',
          borderWidth: 2.5,
          pointRadius: rows.length > 30 ? 0 : 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Reálna',
          data: reals,
          borderColor: '#c8692a',
          backgroundColor: 'rgba(200,105,42,0.08)',
          borderWidth: 2.5,
          pointRadius: rows.length > 30 ? 0 : 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
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
            label: (ctx) => `  ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
          ticks: {
            color: '#7a786f',
            font: { family: "'DM Sans', sans-serif", size: 11 },
            maxTicksLimit: 10,
          },
          border: { display: false },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
          ticks: {
            color: '#7a786f',
            font: { family: "'DM Sans', sans-serif", size: 11 },
            callback: (v) =>
              new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v),
          },
          border: { display: false },
        },
      },
    },
  });
}

// ── Animate number ────────────────────────────────────────────
function animateValue(el, target, isCurrency = true, isPct = false) {
  const duration = 600;
  const start    = performance.now();
  const from     = 0;

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current  = from + (target - from) * ease;
    el.textContent = isCurrency
      ? fmt(current)
      : isPct
      ? fmtPct(current)
      : current.toFixed(2);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Main calculate ────────────────────────────────────────────
function calculate() {
  const amount = parseFloat(amountInput.value);
  const rate   = parseFloat(rateInput.value);
  const years  = parseInt(yearsInput.value, 10);

  // Validation
  if (isNaN(amount) || amount <= 0) {
    shake(amountInput);
    return;
  }
  if (isNaN(rate) || rate < 0) {
    shake(rateInput);
    return;
  }
  if (isNaN(years) || years < 1 || years > 100) {
    shake(yearsInput);
    return;
  }

  const rows     = calcInflation(amount, rate, years);
  const lastRow  = rows[rows.length - 1];
  const lossPct  = lastRow.loss;

  // Show section
  resultsEl.classList.remove('visible');
  void resultsEl.offsetWidth; // reflow to restart animation
  resultsEl.classList.add('visible');

  // Animate summary cards
  animateValue(futureValueEl, lastRow.nominal);
  animateValue(realValueEl, lastRow.real);
  animateValue(lossValueEl, lossPct, false, true);

  // Table & chart
  renderTable(rows);
  renderChart(rows);

  // Scroll to results
  setTimeout(() => resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

// ── Shake animation for invalid inputs ───────────────────────
function shake(el) {
  el.style.transition = 'transform 0.1s ease';
  const frames = [
    { transform: 'translateX(-5px)' },
    { transform: 'translateX(5px)' },
    { transform: 'translateX(-4px)' },
    { transform: 'translateX(4px)' },
    { transform: 'translateX(0)' },
  ];
  el.animate(frames, { duration: 350 });
  el.focus();
  el.style.borderColor = '#c8692a';
  setTimeout(() => (el.style.borderColor = ''), 900);
}

// ── Event listeners ───────────────────────────────────────────
calcBtn.addEventListener('click', calculate);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') calculate();
});

// ── Load Chart.js dynamically ─────────────────────────────────
(function loadChartJS() {
  const script    = document.createElement('script');
  script.src      = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
  script.onload   = () => console.log('Chart.js ready');
  script.onerror  = () => console.error('Chart.js failed to load');
  document.head.appendChild(script);
})();