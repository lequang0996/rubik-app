package com.tenban.cubeallinone;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

/**
 * Google AdMob – 3 loại quảng cáo THỬ NGHIỆM:
 *  1) Banner thích ứng (adaptive) neo ở đáy màn hình – JS nhận chiều cao qua sự kiện "bannerLayout" để chừa chỗ.
 *  2) App Open – hiện khi mở app (nếu kịp tải) và khi quay lại app từ nền.
 *  3) Rewarded (xem có thưởng) – JS gọi showRewarded(); chỉ khi người dùng xem đủ mới trả rewarded = true,
 *     JS sẽ cộng +100 exp.
 *
 * ID quảng cáo lấy từ BuildConfig (build.gradle): mặc định là ID thử nghiệm của Google.
 */
@CapacitorPlugin(name = "Ads")
public class AdsPlugin extends Plugin {

    private static final long APP_OPEN_EXPIRY_MS = 4L * 60 * 60 * 1000;   // ad App Open hết hạn sau 4 giờ
    private static final long APP_OPEN_MIN_GAP_MS = 30_000;               // tối thiểu 30 giây giữa 2 lần hiện App Open
    private static final long COLD_START_WINDOW_MS = 5_000;               // mở app lạnh: chỉ chờ ad tối đa 5 giây

    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean initialized = false;
    private long createdAt = System.currentTimeMillis();

    // ---- Banner ----
    private FrameLayout bannerHost;
    private AdView banner;
    private boolean bannerWanted = false;

    // ---- App Open ----
    private AppOpenAd appOpenAd;
    private long appOpenLoadedAt = 0;
    private boolean appOpenLoading = false;
    private boolean coldStartPending = true;
    private long lastFullscreenEnd = 0;       // lúc một quảng cáo toàn màn hình vừa đóng (chống hiện chồng App Open)
    private boolean fullscreenShowing = false;
    private boolean appOpenEnabled = true;

    // ---- Rewarded ----
    private RewardedAd rewardedAd;
    private boolean rewardedLoading = false;

    @Override
    public void load() {
        final Activity a = getActivity();
        if (a == null) return;
        MobileAds.initialize(a, status -> main.post(() -> {
            initialized = true;
            loadAppOpen();
            loadRewarded();
            if (bannerWanted) showBannerInternal();
        }));
    }

    // =====================================================================  JS API

    /** JS gọi khi app đã sẵn sàng: bật banner + App Open. */
    @PluginMethod
    public void start(final PluginCall call) {
        bannerWanted = true;
        appOpenEnabled = true;
        main.post(() -> {
            if (initialized) showBannerInternal();
            call.resolve();
        });
    }

    @PluginMethod
    public void hideBanner(final PluginCall call) {
        bannerWanted = false;
        main.post(() -> { removeBanner(); call.resolve(); });
    }

    /** Trả {ready:boolean} – quảng cáo có thưởng đã tải sẵn chưa. */
    @PluginMethod
    public void isRewardedReady(final PluginCall call) {
        JSObject o = new JSObject();
        o.put("ready", rewardedAd != null);
        call.resolve(o);
    }

    /**
     * Hiện quảng cáo có thưởng. Resolve:
     *  {status:"earned", rewarded:true}   – xem đủ, được thưởng
     *  {status:"dismissed", rewarded:false} – đóng sớm
     *  {status:"unavailable", rewarded:false} – chưa có quảng cáo (đang tải lại)
     *  {status:"error", rewarded:false}
     */
    @PluginMethod
    public void showRewarded(final PluginCall call) {
        final Activity a = getActivity();
        main.post(() -> {
            if (a == null || rewardedAd == null || fullscreenShowing) {
                if (rewardedAd == null) loadRewarded();
                call.resolve(rewardResult("unavailable", false));
                return;
            }
            final RewardedAd ad = rewardedAd;
            rewardedAd = null;                       // mỗi quảng cáo chỉ dùng được một lần
            final boolean[] earned = {false};
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdShowedFullScreenContent() { fullscreenShowing = true; }
                @Override public void onAdDismissedFullScreenContent() {
                    fullscreenShowing = false;
                    lastFullscreenEnd = System.currentTimeMillis();
                    loadRewarded();                  // nạp sẵn lượt sau
                    call.resolve(rewardResult(earned[0] ? "earned" : "dismissed", earned[0]));
                }
                @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                    fullscreenShowing = false;
                    loadRewarded();
                    call.resolve(rewardResult("error", false));
                }
            });
            ad.show(a, item -> earned[0] = true);   // người dùng xem đủ → đánh dấu được thưởng
        });
    }

    // =====================================================================  Vòng đời → App Open

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (!initialized || !appOpenEnabled) return;
        long now = System.currentTimeMillis();
        if (fullscreenShowing || now - lastFullscreenEnd < APP_OPEN_MIN_GAP_MS) return;   // vừa xem ad khác xong
        if (coldStartPending) {                                                            // lần mở đầu tiên
            coldStartPending = false;
            if (!tryShowAppOpen()) {
                // chưa tải xong → nếu ad về trong vài giây đầu thì vẫn hiện (xem onAppOpenLoaded)
                createdAt = now;
                coldStartWaiting = true;
            }
            return;
        }
        tryShowAppOpen();
    }

    private boolean coldStartWaiting = false;

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // xoay màn hình: tính lại kích thước banner thích ứng
        if (bannerWanted && initialized) main.postDelayed(this::showBannerInternal, 250);
    }

    @Override
    protected void handleOnDestroy() {
        removeBanner();
        super.handleOnDestroy();
    }

    // =====================================================================  Banner

    private void showBannerInternal() {
        final Activity a = getActivity();
        if (a == null || !bannerWanted) return;
        removeBanner();

        DisplayMetrics dm = a.getResources().getDisplayMetrics();
        int widthDp = Math.max(320, (int) (dm.widthPixels / dm.density));
        AdSize size = AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(a, widthDp);

        // khoảng đệm dưới = thanh điều hướng hệ thống (để banner không bị che)
        int bottomInset = 0;
        View decor = a.getWindow().getDecorView();
        WindowInsetsCompat wi = ViewCompat.getRootWindowInsets(decor);
        if (wi != null) {
            Insets i = wi.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            bottomInset = i.bottom;
        }

        banner = new AdView(a);
        banner.setAdUnitId(BuildConfig.ADMOB_BANNER_ID);
        banner.setAdSize(size);

        bannerHost = new FrameLayout(a);
        bannerHost.setBackgroundColor(Color.TRANSPARENT);
        bannerHost.setPadding(0, 0, 0, bottomInset);
        bannerHost.addView(banner, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, size.getHeightInPixels(a), Gravity.CENTER_HORIZONTAL));
        a.addContentView(bannerHost, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));

        final float density = dm.density;
        final int totalPx = size.getHeightInPixels(a) + bottomInset;
        // Báo cho JS chừa chỗ ngay (kể cả khi ad chưa về) để bố cục không bị nhảy
        JSObject o = new JSObject();
        o.put("height", Math.round(totalPx / density));        // CSS px = dp
        o.put("inset", Math.round(bottomInset / density));
        notifyListeners("bannerLayout", o, true);

        banner.setAdListener(new AdListener() {
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) {
                // không có ad → thu gọn chỗ chừa
                JSObject z = new JSObject();
                z.put("height", 0);
                z.put("inset", 0);
                notifyListeners("bannerLayout", z, true);
                if (bannerHost != null) bannerHost.setVisibility(View.GONE);
            }
            @Override public void onAdLoaded() {
                if (bannerHost != null) bannerHost.setVisibility(View.VISIBLE);
                JSObject r = new JSObject();
                r.put("height", Math.round(totalPx / density));
                r.put("inset", Math.round(((bannerHost != null ? bannerHost.getPaddingBottom() : 0)) / density));
                notifyListeners("bannerLayout", r, true);
            }
        });
        banner.loadAd(new AdRequest.Builder().build());
    }

    private void removeBanner() {
        if (banner != null) { banner.destroy(); banner = null; }
        if (bannerHost != null) {
            ViewGroup p = (ViewGroup) bannerHost.getParent();
            if (p != null) p.removeView(bannerHost);
            bannerHost = null;
        }
        JSObject z = new JSObject();
        z.put("height", 0);
        z.put("inset", 0);
        notifyListeners("bannerLayout", z, true);
    }

    // =====================================================================  App Open

    private boolean appOpenFresh() {
        return appOpenAd != null && System.currentTimeMillis() - appOpenLoadedAt < APP_OPEN_EXPIRY_MS;
    }

    private void loadAppOpen() {
        final Activity a = getActivity();
        if (a == null || appOpenLoading || appOpenFresh()) return;
        appOpenLoading = true;
        AppOpenAd.load(a, BuildConfig.ADMOB_APPOPEN_ID, new AdRequest.Builder().build(), new AppOpenAd.AppOpenAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull AppOpenAd ad) {
                appOpenLoading = false;
                appOpenAd = ad;
                appOpenLoadedAt = System.currentTimeMillis();
                // mở app lạnh mà ad về chậm: vẫn hiện nếu còn trong cửa sổ 5 giây đầu
                if (coldStartWaiting && System.currentTimeMillis() - createdAt < COLD_START_WINDOW_MS) {
                    coldStartWaiting = false;
                    tryShowAppOpen();
                }
                coldStartWaiting = false;
            }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) {
                appOpenLoading = false;
                coldStartWaiting = false;
            }
        });
    }

    private boolean tryShowAppOpen() {
        final Activity a = getActivity();
        if (a == null || fullscreenShowing) return false;
        if (!appOpenFresh()) { appOpenAd = null; loadAppOpen(); return false; }
        final AppOpenAd ad = appOpenAd;
        appOpenAd = null;
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override public void onAdShowedFullScreenContent() { fullscreenShowing = true; }
            @Override public void onAdDismissedFullScreenContent() {
                fullscreenShowing = false;
                lastFullscreenEnd = System.currentTimeMillis();
                loadAppOpen();
            }
            @Override public void onAdFailedToShowFullScreenContent(@NonNull AdError e) {
                fullscreenShowing = false;
                loadAppOpen();
            }
        });
        ad.show(a);
        return true;
    }

    // =====================================================================  Rewarded

    private void loadRewarded() {
        final Activity a = getActivity();
        if (a == null || rewardedLoading || rewardedAd != null) return;
        rewardedLoading = true;
        RewardedAd.load(a, BuildConfig.ADMOB_REWARDED_ID, new AdRequest.Builder().build(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(@NonNull RewardedAd ad) {
                rewardedLoading = false;
                rewardedAd = ad;
                JSObject o = new JSObject();
                o.put("ready", true);
                notifyListeners("rewardedReady", o, true);
            }
            @Override public void onAdFailedToLoad(@NonNull LoadAdError e) {
                rewardedLoading = false;
                rewardedAd = null;
                main.postDelayed(AdsPlugin.this::loadRewarded, 30_000);   // thử lại sau 30 giây
            }
        });
    }

    private static JSObject rewardResult(String status, boolean rewarded) {
        JSObject o = new JSObject();
        o.put("status", status);
        o.put("rewarded", rewarded);
        return o;
    }
}
