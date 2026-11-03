// Rubik Studio – điểm vào ứng dụng: dựng bố cục, nối các panel (port gui/main_window.py + Sidebar)
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
  document.title = t('app.title');
  const legend = new LegendButton();
  const bar = new PlayerBar({
    play: () => view.togglePlay(), forward: () => view.stepForward(), back: () => view.stepBack(),
    restart: () => view.restart(), speed: (s) => view.setSpeed(s),
  });
  const guide = new GuidePanel((setup, alg) => onAlg(setup, alg));
  const practice = new PracticePanel({
    onAlg: (setup, alg) => onAlg(setup, alg),
    onCleared: () => {
      if (state.mode === MODE_PRACTICE && view.puzzle) { view.loadState(''); bar.setAlg([]); }
    },
    onHideChanged: (on) => bar.setFormulaHidden(on),
  });
  const play = new PlayPanel(view);

  // thanh bên (máy tính bảng / máy tính)
  const side = $('#sidebar'); clear(side);
  const grid = h('div', { class: 'pgrid' });
  const cards = PUZZLES.map(([key, title]) => {
    const b = h('button', { type: 'button', class: 'pcard', onClick: () => selectPuzzle(key) },
      thumb(puzzleIcon(key), 80), h('span', {}, title));
    grid.append(b);
    return b;
  });
  const sel = h('select', { class: 'select', 'aria-label': t('sidebar.language') },
    i18n.LANGS.map(([c, n]) => h('option', { value: c, selected: c === i18n.language() }, n)));
  sel.addEventListener('change', () => changeLanguage(sel.value));
  side.append(h('div', { class: 'brand' }, 'Rubik Studio'), h('div', { class: 'brandsub' }, t('app.subtitle')),
    h('div', { class: 'section' }, t('sidebar.section')), grid, h('div', { class: 'grow' }),
    h('div', { class: 'brandsub' }, '🌐  ' + t('sidebar.language')), sel, h('div', { class: 'brandsub tip' }, tm('sidebar.tip')));

  // thanh trên (điện thoại)
  const top = $('#topbar'); clear(top);
  const chips = h('div', { class: 'pchips' });
  const chipBtns = PUZZLES.map(([key, title]) => {
    const b = h('button', { type: 'button', class: 'pchip', onClick: () => selectPuzzle(key) }, thumb(puzzleIcon(key), 30), h('span', {}, title));
    chips.append(b);
    return b;
  });
  top.append(chips, h('button', { type: 'button', class: 'iconbtn', 'aria-label': t('sidebar.language'), onClick: openLanguageModal }, '🌐'));

  // chế độ
  const labels = ['📘  ' + t('mode.guide'), '🎯  ' + t('mode.practice'), '🎮  ' + t('mode.play')];
  const seg = new Segmented(labels, (i) => setMode(i));
  const modeHost = $('#modeseg'); clear(modeHost); modeHost.append(seg.el);
  const nav = $('#nav'); clear(nav);
  const navBtns = labels.map((l, i) => {
    const [emo, ...rest] = l.split('  ');
    const b = h('button', { type: 'button', class: 'navbtn', onClick: () => setMode(i) }, h('span', { class: 'emo' }, emo), h('span', {}, rest.join(' ')));
    nav.append(b);
    return b;
  });

  const panes = $('#panes'); clear(panes);
  panes.append(guide.el, practice.el, play.el);
  const legendHost = $('#legendhost'); clear(legendHost); legendHost.append(legend.el);
  const barHost = $('#bar'); clear(barHost); barHost.append(bar.el);

  view.on('progress', (i, n) => bar.setProgress(i, n));
  view.on('playingChanged', (on) => bar.setPlaying(on));
  ui = { legend, bar, guide, practice, play, seg, navBtns, cards, chipBtns, panes };
}

function onAlg(setup, alg) {
  view.loadAlg(setup, alg);
  ui.bar.setAlg(view.steps.map((s) => s.label));   // chỉ hiện trạng thái, bấm ▶ mới xoay
}

async function selectPuzzle(key) {
  state.key = key;
  view.setPuzzle(key);
  ui.legend.setKey(key);
  ui.cards.forEach((b, i) => b.classList.toggle('on', PUZZLES[i][0] === key));
  ui.chipBtns.forEach((b, i) => {
    const on = PUZZLES[i][0] === key;
    b.classList.toggle('on', on);
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  await Promise.all([ui.guide.setPuzzle(key), ui.practice.setPuzzle(key)]);
  if (state.key !== key) return;
  ui.bar.setAlg([]);
  if (state.mode === MODE_PLAY) ui.play.refreshHelp();
}

function setMode(i) {
  state.mode = i;
  $('#app').dataset.mode = String(i);
  ui.seg.setIndex(i);
  ui.navBtns.forEach((b, k) => b.classList.toggle('on', k === i));
  [ui.guide, ui.practice, ui.play].forEach((p, k) => { p.el.style.display = k === i ? '' : 'none'; });
  ui.panes.scrollTop = 0;
  view.setPlayMode(i === MODE_PLAY);
  ui.bar.setFormulaHidden(i === MODE_PRACTICE && ui.practice.formulaHidden);
  requestAnimationFrame(() => view.resize());
  if (i === MODE_PLAY) { ui.play.refreshHelp(); return; }
  view.resetPuzzle();
  ui.bar.setAlg([]);
  if (i === MODE_PRACTICE) {
    ui.bar.setPlaceholder(tm('bar.placeholder.practice'));
    const [levelId, catId] = ui.guide.selection();
    if (!ui.practice.sync(levelId, catId)) ui.practice.reloadCurrent();   // quay lại: hiện lại ca đang luyện
  } else ui.bar.setPlaceholder(tm('bar.placeholder.guide'));
}

async function changeLanguage(code) {
  if (code === i18n.language()) return;
  await i18n.setLanguage(code);
  i18n.saveLanguage(code);
  const { key, mode } = state;
  closeModal();
  build();
  await selectPuzzle(key);
  setMode(mode);
}

// ------------------------------------------------------------------ hộp thoại chọn ngôn ngữ (điện thoại)
function closeModal() { clear($('#modal-root')); }
const modalOpen = () => $('#modal-root').childElementCount > 0;
function openLanguageModal() {
  const list = h('div', { class: 'langlist' }, i18n.LANGS.map(([c, n]) =>
    h('button', { type: 'button', class: 'langbtn' + (c === i18n.language() ? ' on' : ''), onClick: () => changeLanguage(c) },
      h('span', {}, n), c === i18n.language() ? h('span', {}, '✓') : null)));
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
  App.addListener('backButton', () => {
    if (modalOpen()) closeModal();
    else if (!ui.legend.pop.hidden) ui.legend.hide();
    else if (state.mode !== MODE_GUIDE) setMode(MODE_GUIDE);
    else App.exitApp();
  });
}

// ------------------------------------------------------------------ khởi động
(async function init() {
  await i18n.loadSaved();
  build();
  await selectPuzzle('3x3');
  setMode(MODE_GUIDE);
  const sp = $('#splash');
  sp.classList.add('hide');
  setTimeout(() => sp.remove(), 400);
})();

window.__rubik = { view, state, get ui() { return ui; }, selectPuzzle, setMode, changeLanguage };   // phục vụ kiểm thử
