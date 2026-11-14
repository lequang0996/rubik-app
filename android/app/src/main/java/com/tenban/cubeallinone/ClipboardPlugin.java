package com.tenban.cubeallinone;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Đọc / ghi clipboard cho ô nhập công thức riêng (WebView thường chặn navigator.clipboard). */
@CapacitorPlugin(name = "Clip")
public class ClipboardPlugin extends Plugin {

    /** Resolve {value: "văn bản đang sao chép"} (chuỗi rỗng nếu clipboard trống). */
    @PluginMethod
    public void read(PluginCall call) {
        String value = "";
        ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null && cm.hasPrimaryClip()) {
            ClipData clip = cm.getPrimaryClip();
            if (clip != null && clip.getItemCount() > 0) {
                CharSequence cs = clip.getItemAt(0).coerceToText(getContext());
                if (cs != null) value = cs.toString();
            }
        }
        JSObject res = new JSObject();
        res.put("value", value);
        call.resolve(res);
    }

    /** Input {text}: sao chép vào clipboard. */
    @PluginMethod
    public void write(PluginCall call) {
        String text = call.getString("text", "");
        ClipboardManager cm = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm == null) { call.reject("clipboard"); return; }
        cm.setPrimaryClip(ClipData.newPlainText("algorithm", text == null ? "" : text));
        call.resolve();
    }
}
