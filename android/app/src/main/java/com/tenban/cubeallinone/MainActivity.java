package com.tenban.cubeallinone;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InAppUpdatePlugin.class);   // phải đăng ký trước super.onCreate()
        super.onCreate(savedInstanceState);
    }
}
