// Quảng cáo THỬ NGHIỆM (Google AdMob): banner · mở app (App Open) · xem có thưởng (Rewarded, +100 exp mỗi lần)
// Cầu nối native: android/.../AdsPlugin.java. Chạy ngoài Android (trình duyệt) thì banner / App Open bỏ qua,
// còn "xem có thưởng" được mô phỏng để thử luồng cộng exp.
import { t } from './i18n.js';
import { progress, REWARD_EXP } from './progress.js';
import { toast, fmtNum } from './levelui.js';

const Cap = window.Capacitor;
const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const plugin = native ? Cap.registerPlugin('Ads') : null;
let busy = false;

// Banner native nằm đè lên đáy WebView → chừa chỗ bằng biến CSS --ad-h (px) để không che thanh điều hướng của app
function applyBannerLayout({ height }) {
  const h = Math.max(0, Number(height) || 0);
  const root = document.documentElement;
  root.style.setProperty('--ad-h', `${h}px`);
  root.classList.toggle('has-banner', h > 0);
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));   // canvas 3D đo lại kích thước
}

export async function initAds() {
  if (!plugin) return;
  try {
    await plugin.addListener('bannerLayout', applyBannerLayout);
    await plugin.start();                       // bật banner + App Open (ID thử nghiệm đặt trong android/app/build.gradle)
  } catch { /* thiết bị không có Google Play services → bỏ qua, app vẫn dùng bình thường */ }
}

// Xem quảng cáo có thưởng → xem đủ thì +REWARD_EXP exp. Trả về true nếu đã được thưởng.
export async function watchRewardedAd() {
  if (busy) return false;
  busy = true;
  try {
    let res;
    if (plugin) {
      res = await plugin.showRewarded();
    } else {                                    // trình duyệt: mô phỏng để thử luồng thưởng
      toast(t('ads.loading'), 'info');
      await new Promise((r) => setTimeout(r, 1500));
      res = { status: 'earned', rewarded: true };
    }
    if (res && res.rewarded) {
      progress.add(REWARD_EXP);                 // tự phát sự kiện 'change' / 'levelup' (thông báo lên cấp, mở khoá…)
      progress.save();
      toast(t('ads.earned', { n: fmtNum(REWARD_EXP) }), 'up');
      return true;
    }
    toast(t(res && res.status === 'dismissed' ? 'ads.dismissed' : res && res.status === 'error' ? 'ads.error' : 'ads.unavailable'), 'info');
    return false;
  } catch {
    toast(t('ads.error'), 'info');
    return false;
  } finally {
    busy = false;
  }
}
