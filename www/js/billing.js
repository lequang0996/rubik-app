// Google Play Billing: gói tháng tự động gia hạn + mua lẻ exp. Cầu nối native: android/.../BillingPlugin.java.
// Quyền lợi luôn lấy từ Google Play (getPurchases) mỗi lần mở app / quay lại app; bộ nhớ đệm chỉ dùng khi Play tạm không truy cập được.
import { t } from './i18n.js';
import { progress } from './progress.js';
import { BASE_RATE, SUBS, PACKS, subById, packExp, bestPlan, claimsFor } from './plans.js';
import { toast, fmtNum } from './levelui.js';
import { setAdFree } from './ads.js';

const Cap = window.Capacitor;
const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const plugin = native ? Cap.registerPlugin('Billing') : null;

const KEY = 'rubik_studio_billing';
const CACHE_TTL = 7 * 24 * 3600 * 1000;      // Play không truy cập được: vẫn tin gói đã xác minh lần cuối trong 7 ngày
// st: plan = ID gói đã xác minh · token = purchaseToken của nó · at = lúc xác minh · first/month = thưởng đã nhận · granted = purchaseToken mua lẻ đã cộng exp
const st = { plan: '', token: '', at: 0, first: {}, month: '', granted: [] };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch { /* chưa có */ }
if (!Array.isArray(st.granted)) st.granted = [];
if (!st.first || typeof st.first !== 'object') st.first = {};
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* bỏ qua */ } };

const listeners = new Set();
export const onBillingChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((f) => f());

// Gói đang hiệu lực (theo lần xác minh gần nhất, còn trong hạn đệm)
export const currentPlan = () => (Date.now() - st.at < CACHE_TTL ? subById(st.plan) : null);
export const billingAvailable = () => !!plugin;

let applied = undefined;
function applyPlan(plan) {
  const id = plan ? plan.id : '';
  if (applied === id) return;
  applied = id;
  progress.setRate(plan ? plan.rate : BASE_RATE);
  setAdFree(!!plan);                         // gói bất kỳ: bỏ quảng cáo mở app + biểu ngữ (giữ quảng cáo nhận thưởng)
  emit();
}

// Nhận thưởng lần đầu / đầu tháng của gói đang dùng (lưu trạng thái TRƯỚC khi cộng để không bao giờ cộng hai lần)
function claimBonuses() {
  const plan = currentPlan();
  if (!plan) return;
  const r = claimsFor(st, plan, new Date());
  if (!r.first && !r.monthly && r.state.month === st.month && JSON.stringify(r.state.first) === JSON.stringify(st.first)) return;
  st.first = r.state.first; st.month = r.state.month;
  persist();
  if (r.first > 0) { progress.grant(r.first); toast(t('shop.bonus.first', { n: fmtNum(r.first) }), 'up'); }
  if (r.monthly > 0) { progress.grant(r.monthly); toast(t('shop.bonus.month', { n: fmtNum(r.monthly) }), 'up'); }
}

// Gói mua lẻ: cộng exp đúng một lần cho mỗi purchaseToken, rồi báo Play "đã dùng" (consume) để mua lại được
async function redeemPack(p, announce) {
  const exp = packExp(p.id);
  if (!exp || !p.token) return;
  if (!st.granted.includes(p.token)) {
    st.granted.push(p.token);
    st.granted = st.granted.slice(-100);
    persist();
    progress.grant(exp);
    if (announce) toast(t('shop.ok.pack', { n: fmtNum(exp) }), 'up');
  }
  try { await plugin.consume({ token: p.token }); } catch { /* lần mở sau sẽ thử lại; token đã ghi nên không cộng trùng */ }
}

let lastRefresh = 0, refreshing = null;
export function refreshBilling() {
  if (!plugin) return Promise.resolve();
  if (refreshing) return refreshing;
  refreshing = (async () => {
    let res = null;
    try { res = await plugin.getPurchases(); } catch { res = null; }
    lastRefresh = Date.now();
    if (res && res.ok) {
      const subs = res.subs || [];
      const plan = bestPlan(subs.map((s) => s.id));
      st.plan = plan ? plan.id : '';
      st.token = plan ? ((subs.find((s) => s.id === plan.id) || {}).token || '') : '';
      st.at = Date.now();
      persist();
      applyPlan(plan);
      claimBonuses();
      for (const p of res.packs || []) await redeemPack(p, true);
      emit();
    }
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function onPurchaseUpdate(ev) {
  const status = ev && ev.status;
  if (status === 'canceled') { toast(t('shop.canceled'), 'info'); return; }
  if (status === 'pending') { toast(t('shop.pending'), 'info'); return; }
  if (status === 'already_owned') { await refreshBilling(); return; }
  if (status !== 'ok') { toast(t('shop.error'), 'info'); return; }
  let boughtSub = null;
  for (const p of ev.purchases || []) {
    if (p.state !== 'purchased') continue;
    if (packExp(p.id)) await redeemPack(p, true);
    else if (subById(p.id)) boughtSub = subById(p.id);
  }
  if (boughtSub) toast(t('shop.ok.sub', { p: t('shop.plan', { n: boughtSub.usd }) }), 'up');
  await refreshBilling();                    // đọc lại quyền lợi từ Play (nâng/hạ gói, thưởng lần đầu, bỏ quảng cáo…)
}

let busy = false;
export async function buy(id) {
  if (!plugin) { toast(t('shop.native'), 'info'); return false; }
  if (busy) return false;
  busy = true;
  try {
    const sub = subById(id);
    const body = { productId: id, type: sub ? 'subs' : 'inapp' };
    const cur = currentPlan();
    if (sub && cur && cur.id !== id && st.token) { body.oldToken = st.token; body.upgrade = sub.usd > cur.usd; }   // đổi gói: Play tính chênh lệch
    const r = await plugin.buy(body);
    if (!r || r.status !== 'launched') { toast(t(r && r.status === 'unavailable' ? 'shop.unavail' : 'shop.error'), 'info'); return false; }
    return true;
  } catch {
    toast(t('shop.error'), 'info');
    return false;
  } finally {
    busy = false;
  }
}

// Giá do Google Play trả về (đã theo tiền tệ + quốc gia của người dùng). Trả { available, prices: { [productId]: "₫25.000" } }
export async function loadPrices() {
  if (!plugin) return { available: false, prices: {} };
  try {
    const r = await plugin.getProducts();
    const prices = {};
    for (const p of [...(r.subs || []), ...(r.packs || [])]) prices[p.id] = p.price;
    return { available: !!r.available, prices };
  } catch { return { available: false, prices: {} }; }
}

export function manageSubscription() {
  const p = currentPlan();
  if (plugin) plugin.manageSubscriptions({ productId: p ? p.id : '' }).catch(() => {});
}

export async function initBilling() {
  applyPlan(currentPlan());                   // áp tốc độ exp + bỏ quảng cáo ngay từ bộ nhớ đệm, trước khi Play trả lời
  if (!plugin) return;
  try { await plugin.addListener('purchaseUpdate', onPurchaseUpdate); } catch { /* bỏ qua */ }
  await refreshBilling();
  // mỗi phút: hết hạn đệm → về gói thường; sang tháng mới → nhận thưởng đầu tháng
  setInterval(() => { applyPlan(currentPlan()); claimBonuses(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastRefresh > 5 * 60000) refreshBilling(); });
}

export { SUBS, PACKS };
