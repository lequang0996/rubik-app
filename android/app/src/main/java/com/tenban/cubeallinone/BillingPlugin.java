package com.tenban.cubeallinone;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Play Billing (thư viện 8.x).
 *  - 4 subscription tự động gia hạn theo tháng (cube_sub_1/5/10/15, base plan "monthly")
 *  - 4 sản phẩm mua một lần dùng nhiều lần (exp_pack_1/10/100) – JS cộng exp rồi gọi consume()
 *
 * Quyền lợi KHÔNG tính ở đây: JS gọi getPurchases() để biết gói nào đang hiệu lực (Play là nguồn sự thật)
 * rồi tự áp tốc độ exp / bỏ quảng cáo / thưởng. Kết quả mua gửi về JS qua sự kiện "purchaseUpdate".
 * Subscription được acknowledge ngay tại đây (Play sẽ hoàn tiền nếu không acknowledge trong 3 ngày).
 */
@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin implements PurchasesUpdatedListener {

    static final String[] SUB_IDS = {"cube_sub_1", "cube_sub_5", "cube_sub_10", "cube_sub_15"};
    static final String[] PACK_IDS = {"exp_pack_1", "exp_pack_10", "exp_pack_100"};
    private static final String BASE_PLAN = "monthly";

    private final Handler main = new Handler(Looper.getMainLooper());
    private BillingClient client;
    private boolean connecting = false;
    private final List<Runnable> okQueue = new ArrayList<>();
    private final List<Runnable> failQueue = new ArrayList<>();
    private final Map<String, ProductDetails> details = new HashMap<>();

    @Override
    public void load() {
        // kết nối sớm để lần mở cửa hàng / kiểm tra quyền lợi đầu tiên nhanh hơn
        main.post(() -> ensure(() -> { }, () -> { }));
    }

    // =====================================================================  Kết nối

    /** Gọi trên luồng chính. Chạy ok khi đã kết nối Play, fail nếu không kết nối được. */
    private void ensure(final Runnable ok, final Runnable fail) {
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        if (client.isReady()) { ok.run(); return; }
        okQueue.add(ok);
        failQueue.add(fail);
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                main.post(() -> finishConnect(r.getResponseCode() == BillingClient.BillingResponseCode.OK));
            }
            @Override public void onBillingServiceDisconnected() {
                main.post(() -> { if (connecting) finishConnect(false); });
            }
        });
    }

    private void finishConnect(boolean success) {
        connecting = false;
        List<Runnable> run = new ArrayList<>(success ? okQueue : failQueue);
        okQueue.clear();
        failQueue.clear();
        for (Runnable r : run) r.run();
    }

    // =====================================================================  JS API

    /** Giá + thông tin các sản phẩm. Resolve {available, subs:[{id,price,micros,currency}], packs:[…]}. */
    @PluginMethod
    public void getProducts(final PluginCall call) {
        main.post(() -> ensure(() -> {
            final JSArray subs = new JSArray(), packs = new JSArray();
            queryType(BillingClient.ProductType.SUBS, SUB_IDS, subList -> {
                for (ProductDetails pd : subList) { details.put(pd.getProductId(), pd); JSObject o = subInfo(pd); if (o != null) subs.put(o); }
                queryType(BillingClient.ProductType.INAPP, PACK_IDS, packList -> {
                    for (ProductDetails pd : packList) { details.put(pd.getProductId(), pd); JSObject o = packInfo(pd); if (o != null) packs.put(o); }
                    JSObject res = new JSObject();
                    res.put("available", subs.length() > 0 || packs.length() > 0);
                    res.put("subs", subs);
                    res.put("packs", packs);
                    call.resolve(res);
                });
            });
        }, () -> call.resolve(unavailable())));
    }

    /**
     * Quyền lợi hiện tại. Resolve {ok, subs:[{id,token,orderId,autoRenewing,time}], packs:[{id,token,orderId}]}.
     * Chỉ gồm giao dịch đã thanh toán xong (PURCHASED). Gói bị tạm ngưng/hết hạn không có mặt ở đây.
     * packs = sản phẩm mua lẻ CHƯA consume (JS cộng exp rồi gọi consume).
     */
    @PluginMethod
    public void getPurchases(final PluginCall call) {
        main.post(() -> ensure(() -> {
            client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (subRes, subList) -> {
                if (subRes.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.resolve(failed()); return; }
                client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(), (packRes, packList) -> {
                    if (packRes.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.resolve(failed()); return; }
                    JSArray subs = new JSArray(), packs = new JSArray();
                    for (Purchase p : subList) {
                        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                        acknowledgeIfNeeded(p);
                        subs.put(purchaseJson(p, "purchased"));
                    }
                    for (Purchase p : packList) {
                        if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) packs.put(purchaseJson(p, "purchased"));
                    }
                    JSObject res = new JSObject();
                    res.put("ok", true);
                    res.put("subs", subs);
                    res.put("packs", packs);
                    call.resolve(res);
                });
            });
        }, () -> call.resolve(failed())));
    }

    /**
     * Mở hộp thanh toán của Play. Input {productId, type:"subs"|"inapp", oldToken?, upgrade?}.
     * Resolve {status:"launched"|"unavailable"|"error"}; kết quả mua thật gửi qua sự kiện "purchaseUpdate".
     * Đổi gói (oldToken): nâng gói tính chênh lệch ngay, hạ gói áp dụng từ kỳ sau.
     */
    @PluginMethod
    public void buy(final PluginCall call) {
        final String id = call.getString("productId", "");
        final boolean isSub = "subs".equals(call.getString("type", "subs"));
        final String oldToken = call.getString("oldToken", "");
        final boolean upgrade = Boolean.TRUE.equals(call.getBoolean("upgrade", true));
        final Activity activity = getActivity();
        main.post(() -> ensure(() -> {
            if (activity == null) { call.resolve(status("error")); return; }
            final ProductDetails pd = details.get(id);
            if (pd != null) { launch(call, activity, pd, isSub, oldToken, upgrade); return; }
            // chưa tải thông tin sản phẩm (chưa mở cửa hàng): tải rồi mua
            queryType(isSub ? BillingClient.ProductType.SUBS : BillingClient.ProductType.INAPP, new String[]{id}, list -> {
                for (ProductDetails d : list) details.put(d.getProductId(), d);
                ProductDetails loaded = details.get(id);
                if (loaded == null) call.resolve(status("unavailable"));
                else launch(call, activity, loaded, isSub, oldToken, upgrade);
            });
        }, () -> call.resolve(status("unavailable"))));
    }

    /** Báo Play "đã dùng" sản phẩm mua lẻ để mua lại được. Input {token}. */
    @PluginMethod
    public void consume(final PluginCall call) {
        final String token = call.getString("token", "");
        if (token == null || token.isEmpty()) { call.reject("token"); return; }
        main.post(() -> ensure(() -> client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build(), (r, t) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) call.resolve();
            else call.reject("consume " + r.getResponseCode());
        }), () -> call.reject("unavailable")));
    }

    // =====================================================================  Kết quả mua

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, List<Purchase> purchases) {
        final int code = r.getResponseCode();
        final JSObject ev = new JSObject();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            JSArray arr = new JSArray();
            boolean pending = false;
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) {
                    acknowledgeIfNeeded(p);
                    arr.put(purchaseJson(p, "purchased"));
                } else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                    pending = true;
                }
            }
            ev.put("status", arr.length() == 0 && pending ? "pending" : "ok");
            ev.put("purchases", arr);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            ev.put("status", "canceled");
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            ev.put("status", "already_owned");
        } else {
            ev.put("status", "error");
            ev.put("code", code);
        }
        notifyListeners("purchaseUpdate", ev, true);
    }

    // =====================================================================  Hỗ trợ

    private void launch(PluginCall call, Activity activity, ProductDetails pd, boolean isSub, String oldToken, boolean upgrade) {
        BillingFlowParams.ProductDetailsParams.Builder pb = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd);
        if (isSub) {
            ProductDetails.SubscriptionOfferDetails offer = pickOffer(pd);
            if (offer == null) { call.resolve(status("unavailable")); return; }
            pb.setOfferToken(offer.getOfferToken());
        }
        BillingFlowParams.Builder fb = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(Collections.singletonList(pb.build()));
        if (isSub && oldToken != null && !oldToken.isEmpty()) {
            fb.setSubscriptionUpdateParams(BillingFlowParams.SubscriptionUpdateParams.newBuilder()
                .setOldPurchaseToken(oldToken)
                .setSubscriptionReplacementMode(upgrade
                    ? BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE
                    : BillingFlowParams.SubscriptionUpdateParams.ReplacementMode.DEFERRED)
                .build());
        }
        BillingResult r = client.launchBillingFlow(activity, fb.build());
        call.resolve(status(r.getResponseCode() == BillingClient.BillingResponseCode.OK ? "launched" : "error"));
    }

    private interface ProductsCallback { void done(List<ProductDetails> list); }

    private void queryType(String type, String[] ids, final ProductsCallback cb) {
        List<QueryProductDetailsParams.Product> products = new ArrayList<>();
        for (String id : ids) products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build());
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(), (r, result) -> {
            List<ProductDetails> list = r.getResponseCode() == BillingClient.BillingResponseCode.OK && result != null
                ? result.getProductDetailsList() : new ArrayList<ProductDetails>();
            final List<ProductDetails> out = list != null ? list : new ArrayList<ProductDetails>();
            main.post(() -> cb.done(out));
        });
    }

    /** Ưu tiên base plan "monthly" không khuyến mãi; không có thì lấy offer đầu tiên. */
    private static ProductDetails.SubscriptionOfferDetails pickOffer(ProductDetails pd) {
        List<ProductDetails.SubscriptionOfferDetails> offers = pd.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        for (ProductDetails.SubscriptionOfferDetails o : offers) {
            if (BASE_PLAN.equals(o.getBasePlanId()) && o.getOfferId() == null) return o;
        }
        return offers.get(0);
    }

    private static JSObject subInfo(ProductDetails pd) {
        ProductDetails.SubscriptionOfferDetails offer = pickOffer(pd);
        if (offer == null) return null;
        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
        if (phases.isEmpty()) return null;
        ProductDetails.PricingPhase ph = phases.get(phases.size() - 1);      // giai đoạn giá định kỳ (sau khuyến mãi nếu có)
        JSObject o = new JSObject();
        o.put("id", pd.getProductId());
        o.put("price", ph.getFormattedPrice());
        o.put("micros", ph.getPriceAmountMicros());
        o.put("currency", ph.getPriceCurrencyCode());
        return o;
    }

    private static JSObject packInfo(ProductDetails pd) {
        ProductDetails.OneTimePurchaseOfferDetails d = pd.getOneTimePurchaseOfferDetails();
        if (d == null) return null;
        JSObject o = new JSObject();
        o.put("id", pd.getProductId());
        o.put("price", d.getFormattedPrice());
        o.put("micros", d.getPriceAmountMicros());
        o.put("currency", d.getPriceCurrencyCode());
        return o;
    }

    private void acknowledgeIfNeeded(Purchase p) {
        if (p.isAcknowledged() || isPack(p)) return;                         // mua lẻ: consume thay cho acknowledge
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), r -> { });
    }

    private static boolean isPack(Purchase p) {
        for (String id : p.getProducts()) if (Arrays.asList(PACK_IDS).contains(id)) return true;
        return false;
    }

    private static JSObject purchaseJson(Purchase p, String state) {
        JSObject o = new JSObject();
        List<String> ids = p.getProducts();
        o.put("id", ids.isEmpty() ? "" : ids.get(0));
        o.put("token", p.getPurchaseToken());
        o.put("orderId", p.getOrderId() == null ? "" : p.getOrderId());
        o.put("autoRenewing", p.isAutoRenewing());
        o.put("time", p.getPurchaseTime());
        o.put("state", state);
        return o;
    }

    private static JSObject status(String s) { JSObject o = new JSObject(); o.put("status", s); return o; }
    private static JSObject failed() { JSObject o = new JSObject(); o.put("ok", false); return o; }
    private static JSObject unavailable() { JSObject o = new JSObject(); o.put("available", false); o.put("subs", new JSArray()); o.put("packs", new JSArray()); return o; }

    @Override
    protected void handleOnDestroy() {
        if (client != null) { client.endConnection(); client = null; }
        super.handleOnDestroy();
    }
}
