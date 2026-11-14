// Công thức do người dùng tự thêm vào từng ca (lưu trên máy): nhập tay hoặc dán, tự chuẩn hoá ký hiệu và kiểm tra bằng engine của puzzle.
import { h, clear } from './dom.js';
import { t } from './i18n.js';
import { icon } from './icons.js';
import { sheetHead } from './sheetui.js';
import { getPuzzle } from './registry.js';
import { moveCount } from './data.js';
import { toast } from './levelui.js';

const KEY = 'rubik_studio_custom_algs';
export const MAX_MOVES = 120;            // tối đa số nước của một công thức
export const MAX_PER_CASE = 12;          // tối đa số công thức tự thêm cho mỗi ca

const read = () => { try { const d = JSON.parse(localStorage.getItem(KEY) || '{}'); return d && typeof d === 'object' ? d : {}; } catch { return {}; } };
const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch { return false; } };

// Mỗi ca được nhận diện bằng puzzle + cấp + mục + tên ca
export const caseKey = (puzzle, level, cat, name) => [puzzle, level, cat, name].join('|');
export const getCustom = (key) => { const l = read()[key]; return Array.isArray(l) ? l.filter((x) => typeof x === 'string') : []; };
export function addCustom(key, alg) {
  const d = read(), l = getCustom(key);
  if (l.includes(alg) || l.length >= MAX_PER_CASE) return false;
  d[key] = [...l, alg];
  return write(d);
}
export function removeCustom(key, alg) {
  const d = read();
  d[key] = getCustom(key).filter((x) => x !== alg);
  if (!d[key].length) delete d[key];
  return write(d);
}

// Chuẩn hoá công thức dán từ nơi khác: dấu nháy kiểu ’ ‘ ′ → ', bỏ ngoặc/dấu phẩy/xuống dòng/số thứ tự/dấu chấm, "R '" → "R'", "R'2" → "R2'"
export function normalizeAlg(text) {
  return String(text || '')
    .replace(/[\u2019\u2018\u00B4\u0060\u2032\u02BC]/g, "'")
    .replace(/(^|\s)\d+\)(?=\s)/g, ' ')                  // "1) R U" → số thứ tự đầu dòng
    .replace(/[()[\]{},;]/g, ' ')
    .replace(/(\w)\s+'/g, "$1'")
    .replace(/'2(?=\s|$)/g, "2'")
    .split(/\s+/).filter((tk) => tk && !/^\d+[.:]+$/.test(tk))   // "2." → số thứ tự đầu dòng
    .map((tk) => tk.replace(/[.:]+$/, '')).filter(Boolean)       // "R U R'." → bỏ dấu chấm cuối câu
    .join(' ');
}

// Trả { ok, alg, n } hoặc { ok:false, code:'empty'|'long'|'bad', tok? }
export function validateAlg(puzzleKey, text) {
  const alg = normalizeAlg(text);
  if (!alg) return { ok: false, code: 'empty' };
  const toks = alg.split(' ');
  if (toks.length > MAX_MOVES * 2 || moveCount(alg) > MAX_MOVES) return { ok: false, code: 'long' };
  const p = getPuzzle(puzzleKey);
  for (const tok of toks) {
    try { p.parse(tok); } catch { return { ok: false, code: 'bad', tok }; }
  }
  return { ok: true, alg, n: moveCount(alg) };
}

// ---- Clipboard: trên Android dùng plugin native (WebView hay chặn navigator.clipboard), trình duyệt dùng API chuẩn
const Cap = window.Capacitor;
const clip = Cap && Cap.isNativePlatform && Cap.isNativePlatform() ? Cap.registerPlugin('Clip') : null;
export async function readClipboard() {
  if (clip) { const r = await clip.read(); return (r && r.value) || ''; }
  return navigator.clipboard.readText();
}
export async function writeClipboard(text) {
  if (clip) { await clip.write({ text }); return; }
  await navigator.clipboard.writeText(text);
}
export async function copyAlg(alg) {
  try { await writeClipboard(alg); toast(t('alg.copied'), 'info'); } catch { toast(t('alg.copyfail'), 'info'); }
}

// Bảng nhập công thức cho một ca. opts: { puzzleKey, title, existing: [công thức đã có], onSave(alg) }
export function openAddAlgSheet({ puzzleKey, title, existing, onSave }) {
  const root = document.getElementById('modal-root');
  const area = h('textarea', { class: 'fbarea algarea', rows: 3, placeholder: t('alg.add.placeholder'), 'aria-label': t('alg.add.title'),
    autocapitalize: 'none', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false' });
  const status = h('div', { class: 'algstatus', role: 'status' });
  const preview = h('div', { class: 'algpreview' });
  let cur = null;
  const save = h('button', { type: 'button', class: 'action primary', disabled: true, onClick: () => doSave() }, t('alg.add.save'));

  const check = () => {
    const v = validateAlg(puzzleKey, area.value);
    cur = null; preview.textContent = ''; save.disabled = true;
    if (v.code === 'empty') { status.textContent = t('alg.add.hint'); status.dataset.kind = ''; return; }
    if (!v.ok) { status.textContent = v.code === 'long' ? t('alg.add.long', { n: MAX_MOVES }) : t('alg.add.bad', { s: v.tok }); status.dataset.kind = 'err'; return; }
    preview.textContent = v.alg;
    if (existing.includes(v.alg)) { status.textContent = t('alg.add.dup'); status.dataset.kind = 'err'; return; }
    cur = v; save.disabled = false;
    status.textContent = t('alg.add.ok', { n: v.n }); status.dataset.kind = 'ok';
  };
  const doSave = () => {
    if (!cur) return;
    if (onSave(cur.alg) === false) { status.textContent = t('alg.add.full', { n: MAX_PER_CASE }); status.dataset.kind = 'err'; return; }
    clear(root);
    toast(t('alg.add.saved'), 'up');
  };
  const doPaste = async () => {
    try {
      const txt = await readClipboard();
      if (txt && txt.trim()) { area.value = txt; check(); area.focus(); } else toast(t('alg.add.pasteempty'), 'info');
    } catch { toast(t('alg.add.pastefail'), 'info'); area.focus(); }
  };
  area.addEventListener('input', check);
  const tools = h('div', { class: 'algtools' },
    h('button', { type: 'button', class: 'action', onClick: doPaste }, icon('paste', 18), h('span', {}, t('alg.add.paste'))),
    h('button', { type: 'button', class: 'action', onClick: () => { area.value = ''; check(); area.focus(); } }, icon('close', 16), h('span', {}, t('alg.add.clear'))));
  const sheet = h('div', { class: 'sheet fbsheet', role: 'dialog', 'aria-label': t('alg.add.title') },
    sheetHead('plus', t('alg.add.title')), h('div', { class: 'sheet-sub' }, title), area, tools, status, preview, save);
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
  check();
  setTimeout(() => area.focus(), 250);
}
