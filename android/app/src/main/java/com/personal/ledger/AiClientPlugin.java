package com.personal.ledger;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

@CapacitorPlugin(name = "AiClient")
public class AiClientPlugin extends Plugin {
    private static final String PREFS_NAME = "ledger_ai_preferences";
    private static final String PREFS_KEY = "deepseek_api_key";
    private static final String KEY_ALIAS = "ledger_deepseek_key";
    private static final String ENDPOINT = "https://api.deepseek.com/responses";

    @PluginMethod
    public void saveApiKey(PluginCall call) {
        String apiKey = call.getString("apiKey", "").trim();
        if (apiKey.length() < 12) {
            call.reject("请输入有效的 DeepSeek API Key");
            return;
        }

        try {
            getPreferences().edit().putString(PREFS_KEY, encrypt(apiKey)).apply();
            JSObject result = new JSObject();
            result.put("configured", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("无法安全保存 API Key", error);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        try {
            String apiKey = readApiKey();
            result.put("configured", apiKey != null && !apiKey.isEmpty());
            call.resolve(result);
        } catch (Exception error) {
            getPreferences().edit().remove(PREFS_KEY).apply();
            result.put("configured", false);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void clearApiKey(PluginCall call) {
        getPreferences().edit().remove(PREFS_KEY).apply();
        JSObject result = new JSObject();
        result.put("configured", false);
        call.resolve(result);
    }

    @PluginMethod
    public void createResponse(PluginCall call) {
        JSObject request = call.getObject("request");
        if (request == null) {
            call.reject("AI 请求内容为空");
            return;
        }

        final String apiKey;
        try {
            apiKey = readApiKey();
        } catch (Exception error) {
            call.reject("无法读取 API Key，请重新保存", error);
            return;
        }

        if (apiKey == null || apiKey.isEmpty()) {
            call.reject("请先在设置中配置 DeepSeek API Key");
            return;
        }

        new Thread(() -> performRequest(call, apiKey, request.toString())).start();
    }

    private void performRequest(PluginCall call, String apiKey, String body) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(120000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Authorization", "Bearer " + apiKey);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

            byte[] requestBytes = body.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(requestBytes.length);
            try (OutputStream stream = connection.getOutputStream()) {
                stream.write(requestBytes);
            }

            int status = connection.getResponseCode();
            InputStream responseStream = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
            String responseBody = readStream(responseStream);

            if (status >= 200 && status < 300) {
                JSObject result = new JSObject();
                result.put("body", responseBody);
                call.resolve(result);
            } else {
                call.reject(buildApiError(status, responseBody));
            }
        } catch (Exception error) {
            call.reject("无法连接 DeepSeek，请检查网络后重试", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String buildApiError(int status, String responseBody) {
        try {
            JSONObject response = new JSONObject(responseBody);
            JSONObject error = response.optJSONObject("error");
            String message = error == null ? "" : error.optString("message", "");
            if (!message.isEmpty()) return "DeepSeek 请求失败（" + status + "）：" + message;
        } catch (Exception ignored) {
            // Fall back to a short status-only error so response internals are not exposed.
        }
        return "DeepSeek 请求失败（" + status + "）";
    }

    private String readStream(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }

    private SharedPreferences getPreferences() {
        return getContext().getSharedPreferences(PREFS_NAME, 0);
    }

    private String readApiKey() throws Exception {
        String encrypted = getPreferences().getString(PREFS_KEY, null);
        return encrypted == null ? null : decrypt(encrypted);
    }

    private SecretKey getOrCreateSecretKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        return generator.generateKey();
    }

    private String encrypt(String plainText) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey());
        byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
            + "."
            + Base64.encodeToString(cipherText, Base64.NO_WRAP);
    }

    private String decrypt(String encoded) throws Exception {
        String[] parts = encoded.split("\\.", 2);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid encrypted key");
        byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
        byte[] cipherText = Base64.decode(parts[1], Base64.NO_WRAP);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
    }
}
