/* =============================
   STICKR — Fabric.js Editor Logic
   ============================= */

(function() {
'use strict';

// ─── CANVAS INIT ───────────────────────────────────────────
let canvasW = 400, canvasH = 200;
let zoomLevel = 1;
const canvas = new fabric.Canvas('sticker-canvas', {
  width: canvasW,
  height: canvasH,
  backgroundColor: '#1a1a1a',
  preserveObjectStacking: true,
  selection: true,
});

// ─── HISTORY (UNDO/REDO) ───────────────────────────────────
let history = [];
let historyIndex = -1;
let isReplaying = false;

function saveHistory() {
  if (isReplaying) return;
  const state = JSON.stringify(canvas.toJSON(['id', 'name']));
  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  history.push(state);
  if (history.length > 50) history.shift();
  historyIndex = history.length - 1;
}

function undo() {
  if (historyIndex <= 0) return setStatus('Nič na vrátenie');
  historyIndex--;
  loadHistory();
}

function redo() {
  if (historyIndex >= history.length - 1) return setStatus('Nič na zopakovanie');
  historyIndex++;
  loadHistory();
}

function loadHistory() {
  isReplaying = true;
  canvas.loadFromJSON(history[historyIndex], () => {
    canvas.renderAll();
    isReplaying = false;
    updateLayersList();
    setStatus('História obnovená');
  });
}

// ─── STATUS ────────────────────────────────────────────────
function setStatus(msg) {
  document.getElementById('status-msg').textContent = msg;
}

// ─── ID GENERATOR ─────────────────────────────────────────
let objCount = 0;
function nextId() { return 'obj_' + (++objCount); }

// ─── CANVAS INFO ──────────────────────────────────────────
function updateCanvasInfo() {
  const pocet = canvas.getObjects().length;

  document.getElementById('info-size').textContent = `${canvasW} × ${canvasH} px`;
  document.getElementById('info-zoom').textContent = `${Math.round(zoomLevel * 100)}%`;

  // Elegantné plurálovanie
  const text = pocet === 1 
    ? "1 prvok" 
    : (pocet >= 2 && pocet <= 4 ? `${pocet} prvky` : `${pocet} prvkov`);

  document.getElementById('info-objects').textContent = text;
}
// ─── CANVAS SIZE PRESETS ──────────────────────────────────
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const w = parseInt(btn.dataset.w);
    const h = parseInt(btn.dataset.h);
    document.getElementById('canvas-width').value = w;
    document.getElementById('canvas-height').value = h;
    applyCanvasSize(w, h);
  });
});

document.getElementById('btn-apply-size').addEventListener('click', () => {
  const w = parseInt(document.getElementById('canvas-width').value);
  const h = parseInt(document.getElementById('canvas-height').value);
  applyCanvasSize(w, h);
});

function applyCanvasSize(w, h) {
  canvasW = w; canvasH = h;
  canvas.setWidth(w);
  canvas.setHeight(h);
  canvas.renderAll();
  updateCanvasInfo();
  saveHistory();
  setStatus(`Plátno: ${w}×${h}px`);
}

// ─── BACKGROUND COLOR ─────────────────────────────────────
document.getElementById('bg-color').addEventListener('input', e => {
  canvas.setBackgroundColor(e.target.value, canvas.renderAll.bind(canvas));
  saveHistory();
});

document.querySelectorAll('.swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    const color = sw.dataset.color;
    if (color === 'transparent') {
      canvas.setBackgroundColor(null, canvas.renderAll.bind(canvas));
    } else {
      canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
      document.getElementById('bg-color').value = color;
    }
    saveHistory();
  });
});

// Gradient background
document.getElementById('btn-gradient').addEventListener('click', () => {
  const grad = new fabric.Gradient({
    type: 'linear',
    gradientUnits: 'pixels',
    coords: { x1: 0, y1: 0, x2: canvasW, y2: canvasH },
    colorStops: [
      { offset: 0, color: '#FF2D2D' },
      { offset: 1, color: '#0d0d0d' }
    ]
  });
  const rect = new fabric.Rect({ width: canvasW, height: canvasH, left: 0, top: 0 });
  rect.set('fill', grad);
  canvas.setBackgroundImage(null, () => {});
  canvas.setBackgroundColor(null, () => {});
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvasW; tempCanvas.height = canvasH;
  const ctx = tempCanvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  g.addColorStop(0, '#FF2D2D');
  g.addColorStop(1, '#0d0d0d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvasW, canvasH);
  fabric.Image.fromURL(tempCanvas.toDataURL(), img => {
    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
      scaleX: 1, scaleY: 1, left: 0, top: 0
    });
  });
  saveHistory();
  setStatus('Gradient pozadie pridané');
});

// ─── ADD TEXT ─────────────────────────────────────────────
document.getElementById('btn-add-text').addEventListener('click', () => {
  const text = new fabric.IText('NALEPKA', {
    left: canvasW / 2,
    top: canvasH / 2,
    originX: 'center',
    originY: 'center',
    fontSize: 40,
    fontFamily: 'Bebas Neue',
    fill: '#ffffff',
    charSpacing: 100,
    id: nextId(),
    name: 'Text',
  });
  canvas.add(text);
  canvas.setActiveObject(text);
  canvas.renderAll();
  saveHistory();
  updateLayersList();
  setStatus('Text pridaný — dvakrát kliknite na úpravu');
});

// ─── ADD IMAGE (CUSTOM PHOTO) ──────────────────────────────
document.getElementById('btn-add-image').addEventListener('click', () => {
  document.getElementById('image-upload').click();
});

document.getElementById('image-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    fabric.Image.fromURL(ev.target.result, img => {
      const maxW = canvasW * 0.8;
      const maxH = canvasH * 0.8;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      img.set({
        left: canvasW / 2,
        top: canvasH / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
        id: nextId(),
        name: 'Obrázok: ' + file.name.split('.')[0],
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveHistory();
      updateLayersList();
      setStatus('Obrázok pridaný: ' + file.name);
    });
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

// Drag & drop images onto canvas area
const canvasArea = document.getElementById('canvas-area');
canvasArea.addEventListener('dragover', e => { e.preventDefault(); canvasArea.classList.add('drag-over'); });
canvasArea.addEventListener('dragleave', () => canvasArea.classList.remove('drag-over'));
canvasArea.addEventListener('drop', e => {
  e.preventDefault();
  canvasArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    fabric.Image.fromURL(ev.target.result, img => {
      const scale = Math.min((canvasW * 0.8) / img.width, (canvasH * 0.8) / img.height, 1);
      img.set({ left: canvasW/2, top: canvasH/2, originX:'center', originY:'center',
        scaleX: scale, scaleY: scale, id: nextId(), name: 'Drag-drop obrázok' });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveHistory();
      updateLayersList();
    });
  };
  reader.readAsDataURL(file);
});

// ─── ADD SHAPES ───────────────────────────────────────────
function addRect() {
  const r = new fabric.Rect({
    left: canvasW/2 - 60, top: canvasH/2 - 30,
    width: 120, height: 60,
    fill: '#FF2D2D', stroke: '#ffffff', strokeWidth: 0,
    rx: 0, ry: 0, id: nextId(), name: 'Obdĺžnik',
  });
  canvas.add(r); canvas.setActiveObject(r); canvas.renderAll();
  saveHistory(); updateLayersList();
}

function addCircle() {
  const c = new fabric.Circle({
    left: canvasW/2 - 40, top: canvasH/2 - 40,
    radius: 40, fill: '#FFD600', stroke: '#ffffff', strokeWidth: 0,
    id: nextId(), name: 'Kruh',
  });
  canvas.add(c); canvas.setActiveObject(c); canvas.renderAll();
  saveHistory(); updateLayersList();
}

function addTriangle() {
  const t = new fabric.Triangle({
    left: canvasW/2 - 40, top: canvasH/2 - 40,
    width: 80, height: 80, fill: '#00E5FF', id: nextId(), name: 'Trojuholník',
  });
  canvas.add(t); canvas.setActiveObject(t); canvas.renderAll();
  saveHistory(); updateLayersList();
}

function addStar() {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? 50 : 25;
    pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  const star = new fabric.Polygon(pts, {
    left: canvasW/2 - 50, top: canvasH/2 - 50,
    fill: '#FFD600', stroke: '#ffffff', strokeWidth: 0,
    id: nextId(), name: 'Hviezda',
  });
  canvas.add(star); canvas.setActiveObject(star); canvas.renderAll();
  saveHistory(); updateLayersList();
}

function addArrow() {
  const arrow = new fabric.Path('M 0 20 L 80 20 L 70 10 M 80 20 L 70 30', {
    left: canvasW/2 - 40, top: canvasH/2 - 20,
    stroke: '#ffffff', strokeWidth: 4, fill: '',
    id: nextId(), name: 'Šípka',
  });
  canvas.add(arrow); canvas.setActiveObject(arrow); canvas.renderAll();
  saveHistory(); updateLayersList();
}

function addLine() {
  const line = new fabric.Line([0, 0, 120, 0], {
    left: canvasW/2 - 60, top: canvasH/2,
    stroke: '#ffffff', strokeWidth: 3,
    id: nextId(), name: 'Čiara',
  });
  canvas.add(line); canvas.setActiveObject(line); canvas.renderAll();
  saveHistory(); updateLayersList();
}

function addPolygon() {
  const pts = [];
  const sides = 6;
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI / sides) * i - Math.PI / 2;
    pts.push({ x: Math.cos(angle) * 45, y: Math.sin(angle) * 45 });
  }
  const poly = new fabric.Polygon(pts, {
    left: canvasW/2 - 45, top: canvasH/2 - 45,
    fill: '#9C27B0', stroke: '#ffffff', strokeWidth: 0,
    id: nextId(), name: 'Šestuholník',
  });
  canvas.add(poly); canvas.setActiveObject(poly); canvas.renderAll();
  saveHistory(); updateLayersList();
}

document.getElementById('btn-add-rect').addEventListener('click', addRect);
document.getElementById('btn-add-circle').addEventListener('click', addCircle);
document.getElementById('btn-add-triangle').addEventListener('click', addTriangle);
document.getElementById('btn-add-star').addEventListener('click', addStar);
document.getElementById('btn-add-arrow').addEventListener('click', addArrow);
document.getElementById('btn-add-line').addEventListener('click', addLine);
document.getElementById('btn-add-polygon').addEventListener('click', addPolygon);

// ─── SVG CUSTOM SHAPES (Photoshop style) ──────────────────
// Each shape: { name, label, path (SVG path d), viewBox [w,h] }
const customShapes = [
  // --- STARS & BURSTS ---
  {
    name: 'Hviezda 5',
    label: '★',
    path: 'M50 5 L61 35 L95 35 L68 57 L79 91 L50 70 L21 91 L32 57 L5 35 L39 35 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Hviezda 6',
    label: '✶',
    path: 'M50 5 L57 35 L87 20 L72 48 L95 58 L65 63 L65 95 L50 72 L35 95 L35 63 L5 58 L28 48 L13 20 L43 35 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Výbuch',
    label: '✸',
    path: 'M50 0 L54 35 L68 8 L60 42 L82 22 L65 50 L95 42 L72 58 L100 65 L70 65 L88 85 L62 72 L65 100 L50 80 L35 100 L38 72 L12 85 L30 65 L0 65 L28 58 L5 42 L35 50 L18 22 L40 42 L32 8 L46 35 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Odznak',
    label: '⬡',
    path: 'M50 2 L58 18 L76 12 L74 30 L90 38 L80 53 L90 68 L74 76 L76 94 L58 88 L50 104 L42 88 L24 94 L26 76 L10 68 L20 53 L10 38 L26 30 L24 12 L42 18 Z',
    vw: 100, vh: 106,
  },
  // --- ARROWS ---
  {
    name: 'Šípka vpravo',
    label: '➤',
    path: 'M0 30 L55 30 L55 10 L90 50 L55 90 L55 70 L0 70 Z',
    vw: 90, vh: 100,
  },
  {
    name: 'Šípka dvojitá',
    label: '⇔',
    path: 'M0 50 L25 15 L25 37 L75 37 L75 15 L100 50 L75 85 L75 63 L25 63 L25 85 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Šípka oblúk',
    label: '↩',
    path: 'M80 20 Q100 50 80 80 L65 80 Q85 50 65 20 Z M10 50 L45 20 L45 35 Q62 35 65 50 Q62 65 45 65 L45 80 L10 50 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Chevron',
    label: '❯',
    path: 'M20 5 L75 50 L20 95 L35 95 L90 50 L35 5 Z',
    vw: 100, vh: 100,
  },
  // --- FLAMES & SPEED ---
  {
    name: 'Plameň',
    label: '▲',
    path: 'M50 100 C20 100 5 80 10 60 C15 40 30 38 28 20 C26 5 38 0 40 0 C38 15 45 18 48 30 C50 20 55 10 58 0 C68 10 65 30 60 45 C65 35 75 38 72 55 C78 48 82 52 80 65 C85 78 70 100 50 100 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Blesk',
    label: '⚡',
    path: 'M60 0 L25 55 L48 55 L40 100 L75 45 L52 45 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Víchrica',
    label: '🌀',
    path: 'M50 10 C70 10 85 25 85 45 C85 65 68 75 55 68 C42 61 40 48 48 40 C54 34 63 36 66 43 C68 49 63 54 57 52 C52 50 51 44 54 41',
    vw: 100, vh: 100,
  },
  {
    name: 'Vlny rýchlosti',
    label: '≋',
    path: 'M0 30 Q20 10 40 30 Q60 50 80 30 Q100 10 120 30 L120 50 Q100 70 80 50 Q60 30 40 50 Q20 70 0 50 Z M0 60 Q20 40 40 60 Q60 80 80 60 Q100 40 120 60 L120 80 Q100 100 80 80 Q60 60 40 80 Q20 100 0 80 Z',
    vw: 120, vh: 100,
  },
  // --- AUTO / RACING ---
  {
    name: 'Cieľová vlajka',
    label: '⛿',
    path: 'M10 0 L10 100 L20 100 L20 0 Z M20 0 L20 50 L70 50 L70 0 Z M20 0 L45 0 L45 25 L20 25 Z M45 0 L70 0 L70 25 L45 25 Z M20 25 L45 25 L45 50 L20 50 Z M45 25 L70 25 L70 50 L45 50 Z',
    vw: 80, vh: 100,
  },
  {
    name: 'Koleso',
    label: '◎',
    path: 'M50 5 A45 45 0 1 1 49.9 5 Z M50 15 A35 35 0 1 0 50.1 15 Z M50 28 L54 44 L70 44 L57 54 L62 70 L50 60 L38 70 L43 54 L30 44 L46 44 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Ozubené koleso',
    label: '⚙',
    path: 'M43 0 L43 12 Q38 13 34 16 L24 9 L9 24 L16 34 Q13 38 12 43 L0 43 L0 57 L12 57 Q13 62 16 66 L9 76 L24 91 L34 84 Q38 87 43 88 L43 100 L57 100 L57 88 Q62 87 66 84 L76 91 L91 76 L84 66 Q87 62 88 57 L100 57 L100 43 L88 43 Q87 38 84 34 L91 24 L76 9 L66 16 Q62 13 57 12 L57 0 Z M50 35 A15 15 0 1 1 49.9 35 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Kľúč',
    label: '🔑',
    path: 'M70 0 A30 30 0 1 1 69.9 0 Z M70 10 A20 20 0 1 0 70.1 10 Z M44 56 L20 80 L28 88 L24 92 L32 100 L38 94 L46 94 L46 86 L54 86 L54 76 L62 70 Z',
    vw: 100, vh: 100,
  },
  // --- SHIELDS & BADGES ---
  {
    name: 'Štít',
    label: '🛡',
    path: 'M50 0 L95 20 L95 50 Q95 80 50 100 Q5 80 5 50 L5 20 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Odznak polícia',
    label: '☆',
    path: 'M50 2 L60 30 L90 30 L67 48 L77 76 L50 58 L23 76 L33 48 L10 30 L40 30 Z M50 2 L50 2 A48 48 0 1 0 50.1 2 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Koruna',
    label: '♛',
    path: 'M5 80 L5 40 L25 65 L50 10 L75 65 L95 40 L95 80 Z',
    vw: 100, vh: 90,
  },
  // --- HEARTS & CROSSES ---
  {
    name: 'Srdce',
    label: '♥',
    path: 'M50 90 Q10 60 10 35 A20 20 0 0 1 50 30 A20 20 0 0 1 90 35 Q90 60 50 90 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Kríž',
    label: '✚',
    path: 'M35 0 L65 0 L65 35 L100 35 L100 65 L65 65 L65 100 L35 100 L35 65 L0 65 L0 35 L35 35 Z',
    vw: 100, vh: 100,
  },
  // --- SKULLS & WINGS ---
  {
    name: 'Lebka',
    label: '☠',
    path: 'M50 5 C25 5 10 22 10 42 C10 58 20 70 35 74 L35 90 L65 90 L65 74 C80 70 90 58 90 42 C90 22 75 5 50 5 Z M35 42 A8 8 0 1 1 34.9 42 Z M65 42 A8 8 0 1 1 64.9 42 Z M40 90 L40 100 L60 100 L60 90 Z M43 58 L50 50 L57 58 Z',
    vw: 100, vh: 105,
  },
  {
    name: 'Krídlo',
    label: '⌂',
    path: 'M50 80 C40 70 10 55 5 30 C15 35 25 30 30 20 C20 18 15 10 20 5 C28 12 32 20 35 30 C38 20 40 12 50 8 C60 12 62 20 65 30 C68 20 72 12 80 5 C85 10 80 18 70 20 C75 30 85 35 95 30 C90 55 60 70 50 80 Z',
    vw: 100, vh: 85,
  },
  // --- MISC DECORATIVE ---
  {
    name: 'Diamant',
    label: '◆',
    path: 'M50 0 L100 40 L50 100 L0 40 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Šestuholník',
    label: '⬡',
    path: 'M50 0 L100 25 L100 75 L50 100 L0 75 L0 25 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Osmouholník',
    label: '⬡',
    path: 'M30 0 L70 0 L100 30 L100 70 L70 100 L30 100 L0 70 L0 30 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Kruh terč',
    label: '◉',
    path: 'M50 0 A50 50 0 1 1 49.9 0 Z M50 10 A40 40 0 1 0 50.1 10 Z M50 25 A25 25 0 1 1 49.9 25 Z M50 35 A15 15 0 1 0 50.1 35 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Štvorzlomok',
    label: '✦',
    path: 'M50 0 L56 44 L100 50 L56 56 L50 100 L44 56 L0 50 L44 44 Z',
    vw: 100, vh: 100,
  },
  {
    name: 'Trojnásobná šípka',
    label: '⟹',
    path: 'M0 22 L50 22 L50 8 L80 35 L50 62 L50 48 L0 48 Z M25 55 L65 55 L65 45 L88 65 L65 85 L65 75 L25 75 Z',
    vw: 90, vh: 95,
  },
];

// Build the symbol grid with SVG previews
const symbolGrid = document.getElementById('symbol-grid');

customShapes.forEach(shape => {
  const btn = document.createElement('button');
  btn.className = 'symbol-btn';
  btn.title = shape.name;

  // Create inline SVG preview
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${shape.vw} ${shape.vh}`);
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.style.display = 'block';

  const pathEl = document.createElementNS(svgNS, 'path');
  pathEl.setAttribute('d', shape.path);
  pathEl.setAttribute('fill', '#e0e0e0');
  pathEl.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(pathEl);
  btn.appendChild(svg);

  btn.addEventListener('click', () => {
    // Normalise path to a ~80px bounding box centered on canvas
    const scaleX = 80 / shape.vw;
    const scaleY = 80 / shape.vh;
    const s = Math.min(scaleX, scaleY);

    const fabricPath = new fabric.Path(shape.path, {
      left: canvasW / 2,
      top: canvasH / 2,
      originX: 'center',
      originY: 'center',
      fill: '#FF2D2D',
      stroke: '',
      strokeWidth: 0,
      scaleX: s,
      scaleY: s,
      fillRule: 'evenodd',
      id: nextId(),
      name: shape.name,
    });

    canvas.add(fabricPath);
    canvas.setActiveObject(fabricPath);
    canvas.renderAll();
    saveHistory();
    updateLayersList();
    setStatus('Tvar pridaný: ' + shape.name);
  });

  symbolGrid.appendChild(btn);
});

// ─── FREEHAND DRAWING ─────────────────────────────────────
const freehandToolbar = document.getElementById('freehand-toolbar');
let isFreehand = false;

document.getElementById('btn-freehand').addEventListener('click', () => {
  isFreehand = true;
  canvas.isDrawingMode = true;
  freehandToolbar.style.display = 'flex';
  updateBrush();
  setStatus('Kresba voľnou rukou — kliknite HOTOVO pre ukončenie');
});

document.getElementById('btn-freehand-exit').addEventListener('click', () => {
  isFreehand = false;
  canvas.isDrawingMode = false;
  freehandToolbar.style.display = 'none';
  saveHistory(); updateLayersList();
  setStatus('Kresba dokončená');
});

function updateBrush() {
  const color = document.getElementById('brush-color').value;
  const size = parseInt(document.getElementById('brush-size').value);
  const type = document.getElementById('brush-type').value;
  canvas.freeDrawingBrush = new fabric[type + 'Brush'](canvas);
  canvas.freeDrawingBrush.color = color;
  canvas.freeDrawingBrush.width = size;
  document.getElementById('brush-size-val').textContent = size;
}

document.getElementById('brush-color').addEventListener('input', updateBrush);
document.getElementById('brush-size').addEventListener('input', updateBrush);
document.getElementById('brush-type').addEventListener('change', updateBrush);

// ─── ZOOM ─────────────────────────────────────────────────
function applyZoom(newZoom) {
  zoomLevel = Math.max(0.1, Math.min(4, newZoom));
  const container = document.getElementById('canvas-container');
  container.style.transform = `scale(${zoomLevel})`;
  updateCanvasInfo();
}

document.getElementById('btn-zoom-in').addEventListener('click', () => applyZoom(zoomLevel + 0.1));
document.getElementById('btn-zoom-out').addEventListener('click', () => applyZoom(zoomLevel - 0.1));
document.getElementById('btn-zoom-reset').addEventListener('click', () => applyZoom(1));

canvasArea.addEventListener('wheel', e => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.05 : 0.05;
  applyZoom(zoomLevel + delta);
});

// ─── OBJECT SELECTION → SHOW PROPERTIES ───────────────────
canvas.on('selection:created', syncPropsPanel);
canvas.on('selection:updated', syncPropsPanel);
canvas.on('selection:cleared', () => {
  document.getElementById('no-selection').style.display = 'block';
  document.getElementById('object-props').style.display = 'none';
});

canvas.on('object:modified', () => { saveHistory(); updateLayersList(); syncPropsPanel(); });
canvas.on('object:added', updateLayersList);

function syncPropsPanel() {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  document.getElementById('no-selection').style.display = 'none';
  document.getElementById('object-props').style.display = 'block';

  // Position & size
  document.getElementById('prop-x').value = Math.round(obj.left);
  document.getElementById('prop-y').value = Math.round(obj.top);
  document.getElementById('prop-w').value = Math.round(obj.getScaledWidth());
  document.getElementById('prop-h').value = Math.round(obj.getScaledHeight());
  document.getElementById('prop-angle').value = Math.round(obj.angle || 0);
  document.getElementById('prop-angle-val').textContent = Math.round(obj.angle || 0) + '°';
  document.getElementById('prop-opacity').value = Math.round((obj.opacity || 1) * 100);
  document.getElementById('prop-opacity-val').textContent = Math.round((obj.opacity || 1) * 100) + '%';

  // Fill & stroke
  const fillGroup = document.getElementById('fill-stroke-group');
  const isLine = obj.type === 'line' || obj.type === 'path';
  fillGroup.style.display = isLine ? 'none' : 'block';

  if (!isLine) {
    const fill = obj.fill || '#FF2D2D';
    if (typeof fill === 'string' && fill.startsWith('#')) {
      document.getElementById('prop-fill').value = fill;
    }
    document.getElementById('prop-stroke').value = obj.stroke || '#ffffff';
    document.getElementById('prop-stroke-width').value = obj.strokeWidth || 0;
  }

  // Shadow
  const hasShadow = !!obj.shadow;
  document.getElementById('prop-shadow-enable').checked = hasShadow;
  document.getElementById('shadow-controls').style.display = hasShadow ? 'block' : 'none';

  // Text props
  const isText = obj.type === 'i-text' || obj.type === 'text';
  document.getElementById('text-props').style.display = isText ? 'block' : 'none';
  if (isText) {
    document.getElementById('prop-text-content').value = obj.text || '';
    document.getElementById('prop-font-family').value = obj.fontFamily || 'Bebas Neue';
    document.getElementById('prop-font-size').value = obj.fontSize || 40;
    document.getElementById('prop-char-spacing').value = obj.charSpacing || 0;
    const textColor = obj.fill || '#ffffff';
    if (typeof textColor === 'string') {
      document.getElementById('prop-text-color').value = textColor.startsWith('#') ? textColor : '#ffffff';
    }
    document.getElementById('btn-bold').classList.toggle('active', obj.fontWeight === 'bold');
    document.getElementById('btn-italic').classList.toggle('active', obj.fontStyle === 'italic');
    document.getElementById('btn-underline').classList.toggle('active', !!obj.underline);
  }

  // Image props
  const isImg = obj.type === 'image';
  document.getElementById('image-props').style.display = isImg ? 'block' : 'none';
}

// ─── PROPERTY INPUTS → APPLY TO OBJECT ────────────────────
function applyToActive(fn) {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  fn(obj);
  canvas.renderAll();
}

document.getElementById('prop-x').addEventListener('change', e =>
  applyToActive(o => o.set('left', parseFloat(e.target.value))));
document.getElementById('prop-y').addEventListener('change', e =>
  applyToActive(o => o.set('top', parseFloat(e.target.value))));

document.getElementById('prop-w').addEventListener('change', e => {
  applyToActive(o => {
    const scale = parseFloat(e.target.value) / o.width;
    o.set('scaleX', scale);
  });
});
document.getElementById('prop-h').addEventListener('change', e => {
  applyToActive(o => {
    const scale = parseFloat(e.target.value) / o.height;
    o.set('scaleY', scale);
  });
});

document.getElementById('prop-angle').addEventListener('input', e => {
  document.getElementById('prop-angle-val').textContent = e.target.value + '°';
  applyToActive(o => o.set('angle', parseFloat(e.target.value)));
});

document.getElementById('prop-opacity').addEventListener('input', e => {
  document.getElementById('prop-opacity-val').textContent = e.target.value + '%';
  applyToActive(o => o.set('opacity', parseFloat(e.target.value) / 100));
});

document.getElementById('prop-fill').addEventListener('input', e =>
  applyToActive(o => o.set('fill', e.target.value)));

document.getElementById('prop-no-fill').addEventListener('change', e =>
  applyToActive(o => o.set('fill', e.target.checked ? 'transparent' : '#FF2D2D')));

document.getElementById('prop-stroke').addEventListener('input', e =>
  applyToActive(o => o.set('stroke', e.target.value)));

document.getElementById('prop-stroke-width').addEventListener('change', e =>
  applyToActive(o => o.set('strokeWidth', parseInt(e.target.value))));

document.getElementById('prop-stroke-style').addEventListener('change', e => {
  applyToActive(o => {
    const v = e.target.value;
    if (v === 'dashed') o.set('strokeDashArray', [8, 4]);
    else if (v === 'dotted') o.set('strokeDashArray', [2, 4]);
    else o.set('strokeDashArray', null);
  });
});

// ─── SHADOW ───────────────────────────────────────────────
function updateShadow() {
  const enabled = document.getElementById('prop-shadow-enable').checked;
  document.getElementById('shadow-controls').style.display = enabled ? 'block' : 'none';
  if (!enabled) { applyToActive(o => o.set('shadow', null)); return; }
  const color = document.getElementById('prop-shadow-color').value;
  const blur = parseInt(document.getElementById('prop-shadow-blur').value);
  const ox = parseInt(document.getElementById('prop-shadow-ox').value);
  const oy = parseInt(document.getElementById('prop-shadow-oy').value);
  applyToActive(o => o.set('shadow', new fabric.Shadow({ color, blur, offsetX: ox, offsetY: oy })));
}

['prop-shadow-enable','prop-shadow-color','prop-shadow-blur','prop-shadow-ox','prop-shadow-oy']
  .forEach(id => document.getElementById(id).addEventListener('change', updateShadow));
['prop-shadow-blur','prop-shadow-ox','prop-shadow-oy']
  .forEach(id => document.getElementById(id).addEventListener('input', updateShadow));

// ─── TEXT PROPERTIES ──────────────────────────────────────
document.getElementById('prop-text-content').addEventListener('input', e =>
  applyToActive(o => o.set('text', e.target.value)));

document.getElementById('prop-font-family').addEventListener('change', e =>
  applyToActive(o => o.set('fontFamily', e.target.value)));

document.getElementById('prop-font-size').addEventListener('change', e =>
  applyToActive(o => o.set('fontSize', parseInt(e.target.value))));

document.getElementById('prop-char-spacing').addEventListener('change', e =>
  applyToActive(o => o.set('charSpacing', parseInt(e.target.value))));

document.getElementById('prop-text-color').addEventListener('input', e =>
  applyToActive(o => o.set('fill', e.target.value)));

document.getElementById('btn-bold').addEventListener('click', () =>
  applyToActive(o => {
    const isBold = o.fontWeight === 'bold';
    o.set('fontWeight', isBold ? 'normal' : 'bold');
    document.getElementById('btn-bold').classList.toggle('active', !isBold);
  }));

document.getElementById('btn-italic').addEventListener('click', () =>
  applyToActive(o => {
    const isIt = o.fontStyle === 'italic';
    o.set('fontStyle', isIt ? 'normal' : 'italic');
    document.getElementById('btn-italic').classList.toggle('active', !isIt);
  }));

document.getElementById('btn-underline').addEventListener('click', () =>
  applyToActive(o => {
    o.set('underline', !o.underline);
    document.getElementById('btn-underline').classList.toggle('active', !!o.underline);
  }));

document.getElementById('btn-align-left').addEventListener('click', () =>
  applyToActive(o => o.set('textAlign', 'left')));
document.getElementById('btn-align-center').addEventListener('click', () =>
  applyToActive(o => o.set('textAlign', 'center')));
document.getElementById('btn-align-right').addEventListener('click', () =>
  applyToActive(o => o.set('textAlign', 'right')));

// Text special effects
document.getElementById('btn-text-outline').addEventListener('click', () =>
  applyToActive(o => {
    o.set({ stroke: '#000000', strokeWidth: 2 });
    setStatus('Obrys textu aplikovaný');
  }));

document.getElementById('btn-text-glow').addEventListener('click', () =>
  applyToActive(o => {
    o.set('shadow', new fabric.Shadow({ color: o.fill || '#ff0000', blur: 15, offsetX: 0, offsetY: 0 }));
    setStatus('Žiara textu aplikovaná');
  }));

document.getElementById('btn-text-arch').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (!obj || (obj.type !== 'i-text' && obj.type !== 'text')) return;
  const text = obj.text;
  const radius = 80;
  const cx = obj.left + obj.getScaledWidth() / 2;
  const cy = obj.top + obj.getScaledHeight() / 2;
  const chars = text.split('');
  const angleStep = Math.PI / Math.max(chars.length, 1);
  canvas.remove(obj);
  chars.forEach((ch, i) => {
    const angle = -Math.PI / 2 + angleStep * i - (angleStep * (chars.length - 1)) / 2;
    const t = new fabric.Text(ch, {
      left: cx + Math.cos(angle) * radius,
      top: cy + Math.sin(angle) * radius,
      originX: 'center', originY: 'center',
      angle: (angle + Math.PI / 2) * (180 / Math.PI),
      fontSize: obj.fontSize || 40,
      fontFamily: obj.fontFamily || 'Bebas Neue',
      fill: obj.fill || '#ffffff',
      id: nextId(), name: 'Oblúk ' + ch,
    });
    canvas.add(t);
  });
  canvas.renderAll();
  saveHistory(); updateLayersList();
  setStatus('Text na oblúku vytvorený');
});

// ─── IMAGE FILTERS ────────────────────────────────────────
function applyImageFilters() {
  const obj = canvas.getActiveObject();
  if (!obj || obj.type !== 'image') return;
  obj.filters = [];
  const brightness = parseFloat(document.getElementById('img-brightness').value);
  const contrast = parseFloat(document.getElementById('img-contrast').value);
  const saturation = parseFloat(document.getElementById('img-saturation').value);
  const hue = parseFloat(document.getElementById('img-hue').value);
  const blur = parseFloat(document.getElementById('img-blur').value);
  if (brightness !== 0) obj.filters.push(new fabric.Image.filters.Brightness({ brightness }));
  if (contrast !== 0) obj.filters.push(new fabric.Image.filters.Contrast({ contrast }));
  if (saturation !== 0) obj.filters.push(new fabric.Image.filters.Saturation({ saturation }));
  if (hue !== 0) obj.filters.push(new fabric.Image.filters.HueRotation({ rotation: hue / 180 * Math.PI }));
  if (blur > 0) obj.filters.push(new fabric.Image.filters.Blur({ blur }));
  obj.applyFilters();
  canvas.renderAll();
}

['img-brightness','img-contrast','img-saturation','img-hue','img-blur'].forEach(id => {
  document.getElementById(id).addEventListener('input', applyImageFilters);
});

document.querySelectorAll('.effect-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'image') return;
    obj.filters = [];
    const effect = btn.dataset.effect;
    if (effect === 'grayscale') obj.filters.push(new fabric.Image.filters.Grayscale());
    else if (effect === 'invert') obj.filters.push(new fabric.Image.filters.Invert());
    else if (effect === 'sepia') obj.filters.push(new fabric.Image.filters.Sepia());
    // 'none' = reset
    obj.applyFilters();
    canvas.renderAll();
    setStatus('Filter aplikovaný: ' + effect);
  });
});

// ─── LAYER CONTROLS ───────────────────────────────────────
document.getElementById('btn-bring-front').addEventListener('click', () =>
  applyToActive(o => { canvas.bringToFront(o); saveHistory(); updateLayersList(); }));
document.getElementById('btn-send-back').addEventListener('click', () =>
  applyToActive(o => { canvas.sendToBack(o); saveHistory(); updateLayersList(); }));
document.getElementById('btn-bring-forward').addEventListener('click', () =>
  applyToActive(o => { canvas.bringForward(o); saveHistory(); updateLayersList(); }));
document.getElementById('btn-send-backward').addEventListener('click', () =>
  applyToActive(o => { canvas.sendBackwards(o); saveHistory(); updateLayersList(); }));

// ─── ALIGNMENT ────────────────────────────────────────────
document.querySelectorAll('[data-align]').forEach(btn => {
  btn.addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const align = btn.dataset.align;
    const ow = obj.getScaledWidth(), oh = obj.getScaledHeight();
    if (align === 'left') obj.set('left', 0);
    else if (align === 'centerH') obj.set('left', (canvasW - ow) / 2);
    else if (align === 'right') obj.set('left', canvasW - ow);
    else if (align === 'top') obj.set('top', 0);
    else if (align === 'centerV') obj.set('top', (canvasH - oh) / 2);
    else if (align === 'bottom') obj.set('top', canvasH - oh);
    obj.setCoords();
    canvas.renderAll();
    saveHistory();
    setStatus('Zarovnané: ' + align);
  });
});

// ─── TRANSFORM ────────────────────────────────────────────
document.getElementById('btn-flip-h').addEventListener('click', () =>
  applyToActive(o => { o.set('flipX', !o.flipX); saveHistory(); }));
document.getElementById('btn-flip-v').addEventListener('click', () =>
  applyToActive(o => { o.set('flipY', !o.flipY); saveHistory(); }));

document.getElementById('btn-duplicate').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  obj.clone(clone => {
    clone.set({ left: obj.left + 20, top: obj.top + 20, id: nextId(), name: (obj.name || 'Kópia') + ' (kópia)' });
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.renderAll();
    saveHistory(); updateLayersList();
    setStatus('Duplikované');
  });
});

document.getElementById('btn-delete').addEventListener('click', () => {
  const obj = canvas.getActiveObject();
  if (!obj) return;
  canvas.remove(obj);
  canvas.renderAll();
  saveHistory(); updateLayersList();
  setStatus('Prvok zmazaný');
});

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') { e.preventDefault(); redo(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    document.getElementById('btn-duplicate').click();
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const obj = canvas.getActiveObject();
    if (obj) { canvas.remove(obj); canvas.renderAll(); saveHistory(); updateLayersList(); }
  }

  // Arrow keys: move object
  const obj = canvas.getActiveObject();
  if (obj) {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { obj.set('left', obj.left - step); obj.setCoords(); canvas.renderAll(); }
    if (e.key === 'ArrowRight') { obj.set('left', obj.left + step); obj.setCoords(); canvas.renderAll(); }
    if (e.key === 'ArrowUp') { obj.set('top', obj.top - step); obj.setCoords(); canvas.renderAll(); }
    if (e.key === 'ArrowDown') { obj.set('top', obj.top + step); obj.setCoords(); canvas.renderAll(); }
    if (['Arrow'].some(a => e.key.startsWith(a))) { saveHistory(); }
  }
  if (e.key === 'Escape' && isFreehand) document.getElementById('btn-freehand-exit').click();
});

// ─── LAYERS LIST ──────────────────────────────────────────
function updateLayersList() {
  const list = document.getElementById('layers-list');
  list.innerHTML = '';
  const objects = canvas.getObjects().slice().reverse();
  const active = canvas.getActiveObject();

  objects.forEach((obj, i) => {
    const item = document.createElement('div');
    item.className = 'layer-item' + (obj === active ? ' selected' : '');

    const icon = document.createElement('span');
    icon.className = 'layer-icon';
    icon.textContent =
      obj.type === 'i-text' || obj.type === 'text' ? '🔤' :
      obj.type === 'image' ? '🖼' :
      obj.type === 'circle' ? '⬤' :
      obj.type === 'triangle' ? '▲' :
      obj.type === 'line' ? '—' :
      obj.type === 'path' ? '✏' : '▬';

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = obj.name || obj.type || 'Objekt';

    const visBtn = document.createElement('button');
    visBtn.className = 'layer-vis-btn';
    visBtn.textContent = obj.visible !== false ? '👁' : '🚫';
    visBtn.title = 'Viditeľnosť';
    visBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      obj.set('visible', obj.visible === false ? true : false);
      canvas.renderAll();
      updateLayersList();
    });

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(visBtn);

    item.addEventListener('click', () => {
      canvas.setActiveObject(obj);
      canvas.renderAll();
      syncPropsPanel();
      updateLayersList();
    });

    list.appendChild(item);
  });

  updateCanvasInfo();
}

// ─── EXPORT PNG ───────────────────────────────────────────
document.getElementById('btn-export-png').addEventListener('click', () => {
  canvas.discardActiveObject();
  canvas.renderAll();
  const dataURL = canvas.toDataURL({
    format: 'png',
    multiplier: 2,
    quality: 1,
  });
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'nalepka.png';
  a.click();
  setStatus('Exportované ako PNG (2×)');
});

// ─── EXPORT SVG ───────────────────────────────────────────
document.getElementById('btn-export-svg').addEventListener('click', () => {
  canvas.discardActiveObject();
  canvas.renderAll();
  const svg = canvas.toSVG();
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nalepka.svg';
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Exportované ako SVG');
});

// ─── NEW CANVAS ───────────────────────────────────────────
document.getElementById('btn-new').addEventListener('click', () => {
  if (!confirm('Vymazať celé plátno a začať odznova?')) return;
  canvas.clear();
  canvas.setBackgroundColor('#1a1a1a', canvas.renderAll.bind(canvas));
  history = []; historyIndex = -1;
  saveHistory();
  updateLayersList();
  setStatus('Nové plátno');
});

// ─── UNDO / REDO BUTTONS ──────────────────────────────────
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

// ─── CANVAS EVENTS FOR HISTORY ────────────────────────────
canvas.on('object:added', () => { if (!isReplaying) saveHistory(); });
canvas.on('object:removed', () => { if (!isReplaying) saveHistory(); });

// ─── INIT ─────────────────────────────────────────────────
saveHistory();
updateLayersList();
updateCanvasInfo();
setStatus('STICKR pripravený — začnite vytvárať nalepky!');

// Add a welcome text
setTimeout(() => {
  const t = new fabric.IText('NALEPKA', {
    left: canvasW / 2,
    top: canvasH / 2,
    originX: 'center',
    originY: 'center',
    fontSize: 64,
    fontFamily: 'Bebas Neue',
    fill: '#8dc63f',
    charSpacing: 200,
    shadow: new fabric.Shadow({ color: 'rgba(141,198,63,0.35)', blur: 20, offsetX: 0, offsetY: 0 }),
    id: nextId(),
    name: 'Uvítací text',
  });
  canvas.add(t);
  canvas.renderAll();
  saveHistory();
  updateLayersList();
}, 100);

})();