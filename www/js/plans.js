// Bảng gói trả phí (Google Play Billing) + quy tắc thưởng. Không import gì để test được bằng Node.
// Khai báo đúng các ID này trong Play Console (xem README mục "Cấu hình Google Play Billing").
export const BASE_RATE = 1;                 // exp mỗi giây khi chưa đăng ký gói nào
export const BASE_PLAN_ID = 'monthly';      // ID gói cơ bản (base plan) của mọi subscription

// Gói tháng tự động gia hạn. Gói cao hơn gồm mọi quyền lợi của gói $1: bỏ quảng cáo mở app + biểu ngữ (giữ quảng cáo nhận thưởng).
//  rate    = exp mỗi giây
//  first   = thưởng một lần khi đăng ký gói này lần đầu
//  monthly = thưởng mỗi đầu tháng (đầu mỗi tháng dương lịch, nhận khi mở app)
export const SUBS = [
  { id: 'cube_sub_1',  usd: 1,  rate: 10,  first: 0,     monthly: 0 },
  { id: 'cube_sub_5',  usd: 5,  rate: 50,  first: 5000,  monthly: 5000 },
  { id: 'cube_sub_10', usd: 10, rate: 150, first: 15000, monthly: 15000 },
  { id: 'cube_sub_15', usd: 15, rate: 300, first: 30000, monthly: 30000 },
];

// Gói mua lẻ (sản phẩm dùng một lần, mua được nhiều lần)
export const PACKS = [
  { id: 'exp_pack_1',    usd: 1,    exp: 1000 },
  { id: 'exp_pack_10',   usd: 10,   exp: 10000 },
  { id: 'exp_pack_100',  usd: 100,  exp: 100000 },
  { id: 'exp_pack_1000', usd: 1000, exp: 1000000 },
];

export const subById = (id) => SUBS.find((p) => p.id === id) || null;
export const packExp = (id) => { const p = PACKS.find((x) => x.id === id); return p ? p.exp : 0; };

// Gói cao nhất trong các subscription đang hiệu lực (null nếu không có)
export function bestPlan(ids) {
  let best = null;
  for (const id of ids || []) { const p = subById(id); if (p && (!best || p.usd > best.usd)) best = p; }
  return best;
}

export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Tính thưởng đang chờ nhận cho gói `plan` tại thời điểm `now`.
// state = { first: { [planId]: true }, month: 'YYYY-MM' } (đã nhận thưởng lần đầu của gói nào / đã nhận thưởng đầu tháng nào).
// Trả { first, monthly, state }: số exp thưởng + trạng thái MỚI (không sửa state cũ).
//  - Lần đầu đăng ký một gói: nhận `first`, và tháng đó coi như đã nhận (không nhận thêm thưởng đầu tháng ngay).
//  - Từ tháng dương lịch kế tiếp: mỗi tháng nhận `monthly` một lần, vào lần mở app đầu tiên của tháng.
export function claimsFor(state, plan, now = new Date()) {
  const next = { first: { ...((state && state.first) || {}) }, month: (state && state.month) || '' };
  let first = 0, monthly = 0;
  if (plan) {
    const mk = monthKey(now);
    if (!next.first[plan.id]) { next.first[plan.id] = true; next.month = mk; first = plan.first; }
    else if (next.month !== mk) { next.month = mk; monthly = plan.monthly; }
  }
  return { first, monthly, state: next };
}
