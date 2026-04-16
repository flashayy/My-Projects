const WORDS = ['designer', 'coder', 'creator', 'builder', 'dreamer'];
const CHARS = '@#$%&?!?<>/\\|*+-_'.split('');
 
let current = 0;
let running = true;
let raf = null;
let timer = null;
 
const display = document.getElementById('display');
const dotsEl  = document.getElementById('dots');
 
function rand() { return CHARS[Math.floor(Math.random() * CHARS.length)]; }
 
function buildDots() {
  dotsEl.innerHTML = '';
  WORDS.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === current ? ' active' : i < current ? ' done' : '');
    dotsEl.appendChild(d);
  });
}
 
function syncDots() {
  const dots = dotsEl.querySelectorAll('.dot');
  dots.forEach((d, i) => {
    d.className = 'dot' + (i === current ? ' active' : i < current ? ' done' : '');
  });
}
 
function setHTML(spans) {
  display.innerHTML = '';
  spans.forEach(s => display.appendChild(s));
}
 
function decryptTo(word, onDone) {
  const len = word.length;
  const locked = new Array(len).fill(false);
  let revealed = 0;
  let startTime = null;
  const duration = 900 + len * 55;
 
  function step(ts) {
    if (!startTime) startTime = ts;
    const ratio = Math.min((ts - startTime) / duration, 1);
    const shouldReveal = Math.floor(ratio * ratio * len);
 
    for (let i = revealed; i < shouldReveal && i < len; i++) {
      locked[i] = true;
    }
    revealed = shouldReveal;
 
    const spans = word.split('').map((ch, i) => {
      const s = document.createElement('span');
      if (locked[i]) {
        s.textContent = ch;
        if (locked[i] === 'new') { s.className = 'lock'; locked[i] = true; }
      } else {
        s.textContent = rand();
        s.className = 'glitch';
      }
      return s;
    });
 
    // mark newly locked
    for (let i = 0; i < len; i++) {
      if (locked[i] && !spans[i].className) spans[i].className = 'lock';
    }
 
    setHTML(spans);
 
    if (ratio < 1) {
      raf = requestAnimationFrame(step);
    } else {
      display.textContent = word;
      onDone();
    }
  }
  raf = requestAnimationFrame(step);
}
 
function encryptFrom(word, onDone) {
  const len = word.length;
  let startTime = null;
  const duration = 420;
 
  function step(ts) {
    if (!startTime) startTime = ts;
    const ratio = Math.min((ts - startTime) / duration, 1);
    const glitched = Math.floor(ratio * ratio * len);
 
    const spans = word.split('').map((ch, i) => {
      const s = document.createElement('span');
      const fromRight = len - 1 - i;
      if (fromRight < glitched) {
        s.textContent = rand();
        s.className = 'glitch';
      } else {
        s.textContent = ch;
      }
      return s;
    });
 
    setHTML(spans);
 
    if (ratio < 1) {
      raf = requestAnimationFrame(step);
    } else {
      onDone();
    }
  }
  raf = requestAnimationFrame(step);
}
 
function cycle() {
  syncDots();
  decryptTo(WORDS[current], () => {
    timer = setTimeout(() => {
      encryptFrom(WORDS[current], () => {
        current = (current + 1) % WORDS.length;
        timer = setTimeout(cycle, 100);
      });
    }, 1700);
  });
}
 
buildDots();
setTimeout(cycle, 300);