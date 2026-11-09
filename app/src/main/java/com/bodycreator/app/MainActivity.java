package com.bodycreator.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private static final int PICK_FILE = 42;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Web aplikacija se servira iz assets preko https://appassets.androidplatform.net/
        // (potrebno za ES module i import map).
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !"appassets.androidplatform.net".equals(request.getUrl().getHost());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Odaberi fajl"), PICK_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");

        setContentView(webView);
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    /** Most između JavaScripta i Androida – spremanje exporta (PNG u Slike, ostalo u Download). */
    private class Bridge {
        @JavascriptInterface
        public String saveFile(String base64, String fileName, String mime) {
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                boolean image = mime != null && mime.startsWith("image/");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    String dir = (image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS) + "/BodyCreator";
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, dir);
                    Uri collection = image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                            : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    ContentResolver cr = getContentResolver();
                    Uri uri = cr.insert(collection, v);
                    if (uri == null) return "Greška: nije moguće kreirati fajl";
                    try (OutputStream os = cr.openOutputStream(uri)) {
                        if (os == null) return "Greška: nije moguće pisati fajl";
                        os.write(data);
                    }
                    return "Spremljeno: " + dir + "/" + fileName;
                } else {
                    File dir = new File(getExternalFilesDir(image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOCUMENTS), "BodyCreator");
                    if (!dir.exists() && !dir.mkdirs()) return "Greška: nema mape";
                    File f = new File(dir, fileName);
                    try (FileOutputStream os = new FileOutputStream(f)) {
                        os.write(data);
                    }
                    return "Spremljeno: " + f.getAbsolutePath();
                }
            } catch (Exception e) {
                return "Greška: " + e.getMessage();
            }
        }
    }
}
