// Màn hình chúc mừng khi lên Lv 30: pháo hoa (canvas), huy hiệu "Thần Rubik", rồi mới lộ món quà đặc biệt
import { h } from './dom.js';
import { t } from './i18n.js';
import { badge } from './badges.js';
import { sound } from './audio.js';
import { renderImage } from './render3d.js';
import { getPuzzle } from './registry.js';

const COLORS = ['#FFD54A', '#FFF3B0', '#FF8A3D', '#FF5C7A', '#7AD7FF', '#9BFFB0', '#C79BFF', '#FFFFFF'];
const REVEAL_MS = 3200;       // sau ngần này mới hiện dòng quà tặng (giữ bất ngờ)
let active = null;

export const isCelebrating = () => !!active;
export function closeCelebration() { if (active) active.close(); }

export function showCelebration() {
  if (active) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = h('canvas', { class: 'cel-canvas' });
  const ctx = cv.getContext('2d');

  let cube = null;
  try { cube = renderImage(getPuzzle('3x3'), 240, -35, 28, 1.0, [], false, true); cube.className = 'cel-cube'; } catch { /* không có ảnh khối thì bỏ qua */ }
  const ok = h('button', { type: 'button', class: 'action primary cel-ok', onClick: () => close() }, t('cel.ok'));
  const gift = h('div', { class: 'cel-gift' },
    h('div', { class: 'cel-gifttitle' }, t('cel.gift')), cube, h('div', { class: 'cel-giftname' }, t('cel.gift.name')),
    h('div', { class: 'cel-note' }, t('cel.note')), ok);
  const card = h('div', { class: 'cel-card' },
    h('div', { class: 'cel-badge' }, badge(30, 128)), h('h2', {}, t('cel.title')),
    h('p', { class: 'cel-sub' }, t('cel.sub', { n: 30, rank: t('rank.30') })), gift);
  const root = h('div', { id: 'celebrate', role: 'dialog', 'aria-modal': 'true' }, cv, card);
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('show'));

  // ---------------- pháo hoa ----------------
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const shells = [], sparks = [];
  const scale = Math.max(0.6, Math.min(W, H) / 420);
  function launch() {
    const ty = H * (0.14 + 0.34 * Math.random()), vy = -H * (0.85 + 0.25 * Math.random());
    shells.push({ x: W * (0.15 + 0.7 * Math.random()), y: H, vy, g: (vy * vy) / (2 * (H - ty)), col: COLORS[(Math.random() * COLORS.length) | 0] });
    sound.launch();
  }
  function explode(x, y) {
    const n = reduce ? 26 : 64 + ((Math.random() * 28) | 0), ring = Math.random() < 0.4;
    const c1 = COLORS[(Math.random() * COLORS.length) | 0], c2 = Math.random() < 0.5 ? COLORS[(Math.random() * COLORS.length) | 0] : c1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
      const sp = (ring ? 250 : 80 + Math.random() * 230) * scale;
      const life = 1.0 + Math.random() * 0.9;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, col: i % 2 ? c1 : c2, r: 1.4 + Math.random() * 1.2 });
    }
    sound.boom(0.7 + Math.random() * 0.4);
  }

  let last = performance.now(), born = last, nextLaunch = last + 250, raf = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    if (now >= nextLaunch) {
      launch();
      const busy = now - born < 9000;
      nextLaunch = now + (busy ? 420 + Math.random() * 480 : 1500 + Math.random() * 900) * (reduce ? 2 : 1);
    }
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.y += s.vy * dt; s.vy += s.g * dt;
      sparks.push({ x: s.x, y: s.y, vx: 0, vy: 20, life: 0.35, max: 0.35, col: s.col, r: 1.3 });
      if (s.vy >= -40) { explode(s.x, s.y); shells.splice(i, 1); }
    }
    const drag = Math.exp(-1.7 * dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= dt;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.vx *= drag; p.vy = p.vy * drag + 170 * scale * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  // ---------------- âm thanh + lộ quà ----------------
  const timers = [setTimeout(() => sound.fanfare(), 280), setTimeout(() => { gift.classList.add('show'); sound.sparkle(); }, REVEAL_MS)];

  function close() {
    if (!active) return;
    active = null;
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    removeEventListener('resize', resize);
    root.classList.remove('show');
    setTimeout(() => root.remove(), 260);
  }
  active = { close };
}
