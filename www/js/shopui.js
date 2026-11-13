// Bảng "Gói thành viên & mua exp": 4 gói tháng tự động gia hạn + 4 gói mua lẻ. Giá lấy từ Google Play.
import { h, clear } from './dom.js';
import { t } from './i18n.js';
import { sheetHead } from './sheetui.js';
import { fmtNum } from './levelui.js';
import { SUBS, PACKS, currentPlan, onBillingChange, loadPrices, buy, manageSubscription, billingAvailable } from './billing.js';

export async function openShopSheet() {
  const root = document.getElementById('modal-root');
  const sheet = h('div', { class: 'sheet shop', role: 'dialog' });
  let data = { available: false, prices: {} }, loading = billingAvailable();

  const feat = (txt) => h('li', {}, txt);
  const planCard = (p) => {
    const cur = currentPlan(), mine = cur && cur.id === p.id, price = data.prices[p.id];
    const label = mine ? t('shop.btn.cur') : !price ? `$${p.usd}` + t('shop.per')
      : t(cur ? (p.usd > cur.usd ? 'shop.btn.up' : 'shop.btn.down') : 'shop.btn.sub', { p: price });
    const btn = h('button', { type: 'button', class: 'action' + (mine ? '' : ' primary'), disabled: mine || !data.available, onClick: () => buy(p.id) }, label);
    const feats = [feat(t('shop.f.noads')), feat(t('shop.f.rate', { n: p.rate }))];
    if (p.first) feats.push(feat(t('shop.f.first', { n: fmtNum(p.first) })));
    if (p.monthly) feats.push(feat(t('shop.f.monthly', { n: fmtNum(p.monthly) })));
    if (p.usd > SUBS[0].usd) feats.unshift(feat(t('shop.f.incl1')));
    return h('div', { class: 'plancard' + (mine ? ' on' : '') },
      h('div', { class: 'planhead' }, h('b', {}, t('shop.plan', { n: p.usd })), mine ? h('span', { class: 'ustate' }, '✓') : null),
      h('ul', { class: 'planfeat' }, feats), btn);
  };
  const packRow = (p) => {
    const price = data.prices[p.id];
    return h('button', { type: 'button', class: 'langbtn packbtn', disabled: !data.available, onClick: () => buy(p.id) },
      h('span', { class: 'steptitle' }, '🎁  ' + t('shop.packname', { e: fmtNum(p.exp) })), h('b', {}, price || `$${p.usd}`));
  };

  const render = () => {
    const cur = currentPlan();
    clear(sheet);
    sheet.append(
      sheetHead('star', t('shop.title')),
      h('div', { class: 'lvline' }, cur ? t('shop.current', { p: t('shop.plan', { n: cur.usd }) }) : t('shop.none')),
      !billingAvailable() ? h('div', { class: 'lvline muted' }, t('shop.native'))
        : (!loading && !data.available) ? h('div', { class: 'lvline muted' }, t('shop.unavail')) : null,
      h('div', { class: 'section' }, t('shop.subs')),
      h('div', { class: 'planlist' }, SUBS.map(planCard)),
      cur && billingAvailable() ? h('button', { type: 'button', class: 'action', onClick: manageSubscription }, t('shop.manage')) : null,
      h('div', { class: 'section' }, t('shop.packs')),
      h('div', { class: 'langlist' }, PACKS.map(packRow)),
      h('div', { class: 'lvline muted shopnote' }, t('shop.note')));
  };
  render();
  clear(root);
  root.append(h('div', { class: 'backdrop', onClick: (e) => { if (e.target === e.currentTarget) clear(root); } }, sheet));
  const off = onBillingChange(() => { if (!sheet.isConnected) off(); else render(); });
  if (loading) { data = await loadPrices(); loading = false; if (sheet.isConnected) render(); }
}
