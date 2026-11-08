// Cube All In One – điểm vào ứng dụng: dựng bố cục, nối các panel (port gui/main_window.py + Sidebar)
import { h, clear, $ } from './dom.js';
import * as i18n from './i18n.js';
import { t, tm } from './i18n.js';
import { PUZZLES, getPuzzle } from './registry.js';
import { PuzzleView, VIEWS } from './viewport.js';
import { renderImage } from './render3d.js';
import { thumb, Segmented, PlayerBar, LegendButton } from './components.js';
import { GuidePanel } from './guide.js';
import { PracticePanel } from './practice.js';
import { PlayPanel } from './play.js';
import { progress, MODE_REQ, UNLOCKS } from './progress.js';
import { LevelPill, toast, unlockText } from './levelui.js';
import { sound } from './audio.js';
import { MenuButton } from './menuui.js';
import { openStatsSheet } from './statsui.js';
import { openFeedbackSheet } from './feedbackui.js';
import { stats } from './stats.js';
import { icon } from './icons.js';
import * as theme from './theme.js';
import { initInAppUpdate } from './updates.js';

const MODE_GUIDE = 0, MODE_PRACTICE = 1, MODE_PLAY = 2;
const view = new PuzzleView($('#view'));
const state = { key: '3x3', mode: MODE_GUIDE };
let ui = null;                      // các thành phần của lần dựng hiện tại
const iconCache = new Map();

function puzzleIcon(key) {
  if (!iconCache.has(key)) {
    const [y, p] = VIEWS[key] || [-35, 28];
    iconCache.set(key, renderImage(getPuzzle(key), 160, y, p, 1.08, [], false));
  }
  return iconCache.get(key);
}

// ------------------------------------------------------------------ dựng giao diện
function build() {
  view.clearHandlers();
  view.on('turn', (ms) => sound.turn(ms));        // tiếng xoay Rubik cho cả 3 chế độ
  document.title = t('app.title');
  const legend = new LegendButton();
  const bar = new PlayerBar({
    play: () => view.togglePlay(), forward: () => view.stepForward(), back: () => view.stepBack(),
    restart: () => view.restart(),
  });
  const guide = new GuidePanel((setup, alg) => onAlg(setup, alg), (sel) => { session.sel[state.key] = sel; saveSession(); });
  const practice = new PracticePanel({
    onAlg: (setup, alg) => onAlg(setup, alg),
    onCleared: () => {
      if (state.mode === MODE_PRACTICE && view.puzzle) { view.loadState(''); bar.setAlg([]); }
    },
    onHideChanged: (on) => bar.setFormulaHidden(on),
  });
  const play = new PlayPanel(view);

  const topPill = new LevelPill(), sidePill = new LevelPill(true);

  // thanh bên (máy tính bảng / máy tính)
  const side = $('#sidebar'); clear(side);
  const grid = h('div', { class: 'pgrid' });
  const cards = PUZZLES.map(([key, title]) => {
    const b = h('button', { type: 'button', class: 'pcard', onClick: () => selectPuzzle(key) },
      thumb(puzzleIcon(key), 80), h('span', {}, title));
    grid.append(b);
    return b;
  });
  side.append(h('div', { class: 'brandrow' }, h('div', {}, h('div', { class: 'brand' }, 'Cube All In One'), h('div', { class: 'brandsub' }, t('app.subtitle'))), MenuButton(menuActions)),
    h('div', { class: 'section' }, t('sidebar.section')), grid, h('div', { class: 'grow' }),
    sidePill.el, h('div', { class: 'brandsub tip' }, tm('sidebar.tip')));

  // thanh trên (điện thoại): nút puzzle (mở danh sách) + cấp độ + ngôn ngữ
  const top = $('#topbar'); clear(top);
  const pIcon = h('span', { class: 'picon' }), pName = h('span', { class: 'pname' });
  const pBtn = h('button', { type: 'button', class: 'pbtn', 'aria-haspopup': 'dialog', onClick: openPuzzleModal }, pIcon, pName, h('span', { class: 'chev' }, '▾'));
  top.append(pBtn, topPill.el, h('span', { class: 'grow' }), MenuButton(menuActions));

  // chế độ
  const labels = [t('mode.guide'), t('mode.practice'), t('mode.play')];
  const NAV_ICONS = ['guide', 'practice', 'play'];
  const seg = new Segmented(labels, (i) => requestMode(i));
  seg.setLocks(MODE_REQ, () => progress.level, (req) => toast(t('lv.locked', { n: req }), 'lock'));
  const modeHost = $('#modeseg'); clear(modeHost); modeHost.append(seg.el);
  const nav = $('#nav'); clear(nav);
  const navBtns = labels.map((l, i) => {
    const b = h('button', { type: 'button', class: 'navbtn', onClick: () => requestMode(i) }, icon(NAV_ICONS[i]), h('span', {}, l));
    nav.append(b);
    return b;
  });

  const panes = $('#panes'); clear(panes);
  panes.append(guide.el, practice.el, play.el);
  const legendHost = $('#legendhost'); clear(legendHost); legendHost.append(legend.el);
  const barHost = $('#bar'); clear(barHost); barHost.append(bar.el);

  view.on('progress', (i, n) => bar.setProgress(i, n));
  view.on('playingChanged', (on) => bar.setPlaying(on));
  ui = { legend, bar, guide, practice, play, seg, navBtns, cards, pIcon, pName, pills: [topPill, sidePill], panes };
  refreshLocks();
}

// Cập nhật mọi thứ phụ thuộc cấp độ người chơi
function refreshLocks() {
  ui.pills.forEach((p) => p.update());
  ui.seg.refreshLocks();
  ui.navBtns.forEach((b, i) => {
    const lk = MODE_REQ[i] > progress.level, ic = b.querySelector('.lockic');
    b.classList.toggle('locked', lk);
    if (lk && !ic) b.querySelector('.ic').after(h('span', { class: 'lockic' }, icon('lock', 11)));
    else if (!lk && ic) ic.remove();
  });
  ui.guide.refreshLocks();
  ui.practice.refreshLocks();
}

function requestMode(i) {
  if (MODE_REQ[i] > progress.level) { toast(t('lv.locked', { n: MODE_REQ[i] }), 'lock'); return; }
  setMode(i);
}

function onAlg(setup, alg) {
  view.loadAlg(setup, alg);
  ui.bar.setAlg(view.steps.map((s) => s.label));   // chỉ hiện trạng thái, bấm ▶ mới xoay
}

// ------------------------------------------------------------------ lưu / khôi phục trạng thái đang xem
const SESSION = 'rubik_studio_session';
const session = (() => {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(SESSION) || '{}') || {}; } catch { d = {}; }
  return { puzzle: d.puzzle || '3x3', mode: Number.isInteger(d.mode) ? d.mode : 0, sel: d.sel && typeof d.sel === 'object' ? d.sel : {} };
})();
function saveSession() { try { localStorage.setItem(SESSION, JSON.stringify(session)); } catch { /* bỏ qua */ } }

async function selectPuzzle(key) {
  const saved = session.sel[key];          // đọc trước: guide.setPuzzle() sẽ ghi đè bằng vị trí mặc định
  state.key = key; session.puzzle = key; saveSession();
  view.setPuzzle(key);
  ui.legend.setKey(key);
  ui.cards.forEach((b, i) => b.classList.toggle('on', PUZZLES[i][0] === key));
  clear(ui.pIcon); ui.pIcon.append(thumb(puzzleIcon(key), 32));
  ui.pName.textContent = PUZZLES.find((p) => p[0] === key)[1];
  await Promise.all([ui.guide.setPuzzle(key), ui.practice.setPuzzle(key)]);
  if (state.key !== key) return;
  ui.bar.setAlg([]);
  if (state.mode === MODE_PLAY) ui.play.refreshHelp();
  ui.guide.restore(saved, state.mode === MODE_GUIDE);   // quay lại đúng cấp / mục / công thức đã xem
}

function setMode(i, keep = false) {
  state.mode = i; session.mode = i; saveSession();
  $('#app').dataset.mode = String(i);
  ui.seg.setIndex(i);
  ui.navBtns.forEach((b, k) => b.classList.toggle('on', k === i));
  [ui.guide, ui.practice, ui.play].forEach((p, k) => { p.el.style.display = k === i ? '' : 'none'; });
  ui.panes.scrollTop = 0;
  view.setPlayMode(i === MODE_PLAY);
  view.setSpeed(1);   // cả 3 chế độ luôn xoay ở tốc độ 1x
  ui.bar.setFormulaHidden(i === MODE_PRACTICE && ui.practice.formulaHidden);
  requestAnimationFrame(() => view.resize());
  if (i === MODE_PLAY) { ui.play.refreshHelp(); return; }
  if (!(keep && i === MODE_GUIDE)) { view.resetPuzzle(); ui.bar.setAlg([]); }   // keep: giữ công thức vừa khôi phục
  if (i === MODE_PRACTICE) {
    ui.bar.setPlaceholder(tm('bar.placeholder.practice'));
    const [levelId, catId] = ui.guide.selection();
    if (!ui.practice.sync(levelId, catId)) ui.practice.reloadCurrent();   // quay lại: hiện lại ca đang luyện
  } else {
    ui.bar.setPlaceholder(tm('bar.placeholder.guide'));
    if (!keep) ui.guide.reloadSelected();         // từ tab khác quay lại: nạp lại công thức đang chọn
  }
}

async function changeLanguage(code) {
  if (code === i18n.language()) return;
  await i18n.setLanguage(code);
  i18n.saveLanguage(code);
  const { key, mode } = state;
  closeModal();
  build();
  await selectPuzzle(key);
  setMode(mode, true);
}

const menuActions = { openLanguage: () => openLanguageModal(), openStats: () => openStatsSheet({ puzzles: PUZZLES, puzzleIcon }), openFeedback: () => openFeedbackSheet() };

// ------------------------------------------------------------------ hộp thoại chọn puzzle / ngôn ngữ (điện thoại)
function openPuzzleModal() {
  const list = h('div', { class: 'langlist' }, PUZZLES.map(([key, title]) =>
    h('button', { type: 'button', class: 'langbtn puzzlebtn' + (key === state.key ? ' on' : ''), onClick: () => { closeModal(); selectPuzzle(key); } },
      thumb(puzzleIcon(key), 40), h('span', { class: 'steptitle' }, title), key === state.key ? h('span', {}, '✓') : null)));
  const root = $('#modal-root');
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) closeModal(); } },
    h('div', { class: 'sheet', role: 'dialog' }, h('div', { class: 'sheet-title' }, t('sidebar.section')), list)));
}

function closeModal() { clear($('#modal-root')); }
const modalOpen = () => $('#modal-root').childElementCount > 0;
function openLanguageModal() {
  // mỗi dòng: cờ - tên bản ngữ (tên theo ngôn ngữ đang dùng), ví dụ "🇬🇧 - English (Tiếng Anh)"
  const list = h('div', { class: 'langlist' }, i18n.LANGS.map(([c]) =>
    h('button', { type: 'button', class: 'langbtn' + (c === i18n.language() ? ' on' : ''), onClick: () => changeLanguage(c) },
      h('span', { class: 'lpname' }, i18n.langLabel(c)), c === i18n.language() ? h('span', {}, '✓') : null)));
  const sheet = h('div', { class: 'sheet', role: 'dialog' },
    h('div', { class: 'sheet-title' }, '🌐  ' + t('sidebar.language')), list, h('div', { class: 'brandsub tip' }, tm('sidebar.tip')));
  const root = $('#modal-root');
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) closeModal(); } }, sheet));
}

// ------------------------------------------------------------------ bàn phím (máy tính / bàn phím rời)
document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'select', 'textarea'].includes(tag)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) view.redo(); else view.undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); view.redo(); return; }
  if (e.altKey || mod) return;
  if (e.code === 'Space' && tag !== 'button') {
    if (state.mode !== MODE_PLAY) { e.preventDefault(); view.togglePlay(); }
    return;
  }
  if (state.mode === MODE_PLAY && e.key.length === 1 && tag !== 'button') {
    if (view.keyToken(e.key, e.shiftKey)) e.preventDefault();
  }
});

// ------------------------------------------------------------------ nút Back của Android
const Cap = window.Capacitor;
if (Cap && Cap.isNativePlatform && Cap.isNativePlatform()) {
  const App = Cap.registerPlugin('App');
  App.addListener('appStateChange', ({ isActive }) => sound.setHidden(!isActive));
  App.addListener('backButton', () => {
    if (modalOpen()) closeModal();
    else if (!ui.legend.pop.hidden) ui.legend.hide();
    else if (state.mode !== MODE_GUIDE) setMode(MODE_GUIDE);
    else App.exitApp();
  });
}

// ------------------------------------------------------------------ khởi động
document.addEventListener('visibilitychange', () => { sound.setHidden(document.hidden); if (document.hidden) saveSession(); });
addEventListener('pagehide', saveSession);
theme.onChange(() => view.update());            // đổi sáng/tối: vẽ lại bóng sàn của khối
sound.armUnlock();                              // trình duyệt/WebView chỉ cho phát âm thanh sau lần chạm đầu tiên

(async function init() {
  await i18n.loadSaved();
  build();
  progress.on('change', () => ui.pills.forEach((p) => p.update()));
  progress.on('levelup', (n, old) => {
    refreshLocks();
    const x = UNLOCKS.filter(([req]) => old < req && n >= req).map(([, k]) => unlockText(k));
    toast(t('lv.up', { n }) + (x.length ? '\n' + t('lv.unlocked', { x: x.join(' · ') }) : ''), 'up');
  });
  progress.start();
  stats.start(() => {                              // mỗi giây: cộng thời gian cho puzzle + mục đang xem
    const p = state.key;
    if (state.mode === MODE_PLAY) return { puzzle: p, bucket: 'play' };
    if (state.mode === MODE_PRACTICE) return { puzzle: p, bucket: `${ui.practice.levelId || '-'}/${ui.practice.poolId || '-'}` };
    const [l, c] = ui.guide.selection();
    return { puzzle: p, bucket: `${l}/${c || '-'}` };
  });
  const startMode = session.mode >= 0 && session.mode <= MODE_PLAY && MODE_REQ[session.mode] <= progress.level ? session.mode : MODE_GUIDE;
  await selectPuzzle(PUZZLES.some((p) => p[0] === session.puzzle) ? session.puzzle : '3x3');
  setMode(startMode, true);
  const sp = $('#splash');
  sp.classList.add('hide');
  setTimeout(() => sp.remove(), 400);
  initInAppUpdate();                            // Google Play In-App Update (Flexible), chỉ chạy trong app Android
})();

window.__rubik = { view, state, get ui() { return ui; }, selectPuzzle, setMode, requestMode, changeLanguage, progress, sound };   // phục vụ kiểm thử
