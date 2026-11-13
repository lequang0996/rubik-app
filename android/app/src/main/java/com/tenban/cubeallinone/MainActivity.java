package com.tenban.cubeallinone;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InAppUpdatePlugin.class);   // phải đăng ký trước super.onCreate()
        registerPlugin(AdsPlugin.class);           // AdMob: banner · App Open · Rewarded
        registerPlugin(BillingPlugin.class);       // Google Play Billing: gói tháng + mua lẻ exp
        super.onCreate(savedInstanceState);
        // Màn hình luôn sáng khi app đang mở (tự tắt cờ khi app ra nền, không cần quyền đặc biệt)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
