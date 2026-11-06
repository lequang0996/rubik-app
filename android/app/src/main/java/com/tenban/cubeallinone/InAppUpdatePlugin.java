package com.tenban.cubeallinone;

import android.app.Activity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * Google Play In-App Updates – chế độ FLEXIBLE.
 *
 * Luồng: JS gọi startFlexibleUpdate() → nếu Play báo có bản mới, Play hiện hộp thoại xin tải ở nền
 * → khi tải xong plugin bắn sự kiện "downloaded" → JS hiện thanh "Khởi động lại" → completeUpdate() cài bản mới.
 * Chỉ hoạt động với bản cài từ Google Play (internal testing / closed / production).
 */
@CapacitorPlugin(name = "InAppUpdate")
public class InAppUpdatePlugin extends Plugin {

    private AppUpdateManager manager;

    private final InstallStateUpdatedListener stateListener = state -> {
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            notifyListeners("downloaded", new JSObject(), true);
        }
    };

    @Override
    public void load() {
        manager = AppUpdateManagerFactory.create(getContext());
        manager.registerListener(stateListener);
    }

    @PluginMethod
    public void startFlexibleUpdate(final PluginCall call) {
        final Activity activity = getActivity();
        if (manager == null || activity == null) {
            call.resolve(result("unavailable"));
            return;
        }
        manager.getAppUpdateInfo()
            .addOnSuccessListener((AppUpdateInfo info) -> {
                if (info.installStatus() == InstallStatus.DOWNLOADED) {
                    // đã tải xong từ lần trước (người dùng chưa bấm khởi động lại)
                    notifyListeners("downloaded", new JSObject(), true);
                    call.resolve(result("downloaded"));
                    return;
                }
                boolean available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);
                if (!available) {
                    call.resolve(result("none"));
                    return;
                }
                try {
                    manager.startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
                        .addOnSuccessListener(code -> call.resolve(result(code == Activity.RESULT_OK ? "accepted" : "declined")))
                        .addOnFailureListener(e -> call.resolve(result("error")));
                } catch (Exception e) {
                    call.resolve(result("error"));
                }
            })
            .addOnFailureListener(e -> call.resolve(result("error")));
    }

    @PluginMethod
    public void completeUpdate(final PluginCall call) {
        if (manager == null) {
            call.reject("unavailable");
            return;
        }
        manager.completeUpdate();   // cài bản đã tải và khởi động lại app
        call.resolve();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // quay lại app: nếu bản cập nhật đã tải xong trong lúc ở nền thì nhắc người dùng khởi động lại
        if (manager == null) return;
        manager.getAppUpdateInfo().addOnSuccessListener(info -> {
            if (info.installStatus() == InstallStatus.DOWNLOADED) {
                notifyListeners("downloaded", new JSObject(), true);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (manager != null) manager.unregisterListener(stateListener);
        super.handleOnDestroy();
    }

    private static JSObject result(String status) {
        JSObject o = new JSObject();
        o.put("status", status);
        return o;
    }
}
