package com.personal.ledger;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;

@CapacitorPlugin(name = "Backup")
public class BackupPlugin extends Plugin {
    @PluginMethod
    public void saveZip(PluginCall call) {
        String filename = call.getString("filename", "ledger-backup.zip");
        String base64 = call.getString("base64");
        if (base64 == null || base64.isEmpty()) {
            call.reject("备份内容为空");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/zip");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "saveZipResult");
    }

    @ActivityCallback
    private void saveZipResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject response = new JSObject();
            response.put("canceled", true);
            call.resolve(response);
            return;
        }

        Uri target = result.getData().getData();
        if (target == null) {
            call.reject("没有选择保存位置");
            return;
        }

        try {
            byte[] bytes = Base64.decode(call.getString("base64"), Base64.DEFAULT);
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(target, "w")) {
                if (stream == null) throw new IllegalStateException("无法打开目标文件");
                stream.write(bytes);
                stream.flush();
            }
            JSObject response = new JSObject();
            response.put("canceled", false);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("保存备份失败", error);
        }
    }
}
