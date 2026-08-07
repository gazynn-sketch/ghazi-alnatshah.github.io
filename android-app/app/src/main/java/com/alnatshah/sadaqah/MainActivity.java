package com.alnatshah.sadaqah;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://gazynn-sketch.github.io/ghazi-alnatshah.github.io/";
    private static final String PRAYER_URL = HOME_URL + "prayer.html";
    private static final int LOCATION_REQUEST = 1101;
    private static final int NOTIFICATION_REQUEST = 1102;

    private WebView webView;
    private ProgressBar progressBar;
    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private boolean waitingForExactAlarmAccess;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(13, 75, 57));
        getWindow().setNavigationBarColor(Color.rgb(13, 75, 57));
        PrayerScheduleManager.createNotificationChannels(this);

        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);

        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                8
        );

        root.addView(webView, webParams);
        root.addView(progressBar, progressParams);
        setContentView(root);

        configureWebView();

        boolean openPrayer = getIntent() != null && getIntent().getBooleanExtra("openPrayer", false);
        if (savedInstanceState == null || openPrayer) {
            webView.loadUrl(openPrayer ? PRAYER_URL : HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }

        if (PrayerScheduleManager.isEnabled(this)) {
            PrayerScheduleManager.refreshFromNetwork(this, null);
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " NatshaFamilyAndroid/1.2.2");

        webView.addJavascriptInterface(new PrayerBridge(), "AndroidPrayer");
        webView.addJavascriptInterface(new ShareBridge(), "AndroidShare");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                String host = uri.getHost();
                if (host != null && ("whatsapp.com".equalsIgnoreCase(host) || "www.whatsapp.com".equalsIgnoreCase(host))) {
                    openExternal(uri);
                    return true;
                }
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    return false;
                }
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                view.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('androidPrayerReady'));",
                        null
                );
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showOfflinePage();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(
                    String origin,
                    GeolocationPermissions.Callback callback
            ) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    pendingGeoOrigin = origin;
                    pendingGeoCallback = callback;
                    requestPermissions(
                            new String[]{
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                            },
                            LOCATION_REQUEST
                    );
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
                openExternal(Uri.parse(url))
        );
    }

    private void requestPrayerPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_REQUEST
            );
            return;
        }
        requestExactAlarmAccessIfNeeded();
    }

    private void requestExactAlarmAccessIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            PrayerScheduleManager.rescheduleSaved(this);
            return;
        }
        AlarmManager alarmManager = (AlarmManager) getSystemService(ALARM_SERVICE);
        if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
            try {
                waitingForExactAlarmAccess = true;
                Intent intent = new Intent(
                        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + getPackageName())
                );
                startActivity(intent);
                return;
            } catch (Exception ignored) {
            }
        }
        PrayerScheduleManager.rescheduleSaved(this);
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception ignored) {
            // Unsupported external link; keep the app open.
        }
    }

    private void shareWhatsAppMessage(String message) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, message == null ? "" : message);

        String[] packages = {"com.whatsapp", "com.whatsapp.w4b"};
        for (String packageName : packages) {
            send.setPackage(packageName);
            if (send.resolveActivity(getPackageManager()) != null) {
                try {
                    startActivity(send);
                    return;
                } catch (Exception ignored) {
                }
            }
        }

        send.setPackage(null);
        try {
            startActivity(Intent.createChooser(send, "مشاركة الرسالة"));
        } catch (Exception ignored) {
        }
    }

    private void openSmsComposer(String recipients, String message) {
        String addresses = recipients == null ? "" : recipients
                .replace(",", ";")
                .replace(" ", "");
        Intent sms = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + addresses));
        sms.putExtra("address", addresses);
        sms.putExtra("sms_body", message == null ? "" : message);
        try {
            startActivity(sms);
        } catch (Exception ignored) {
            openExternal(Uri.parse("sms:" + addresses));
        }
    }

    private void showOfflinePage() {
        String html = "<!doctype html><html dir='rtl' lang='ar'><head>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                + "<style>body{font-family:Tahoma,Arial;background:#fffaf0;color:#17372d;"
                + "display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}"
                + ".c{padding:30px}button{border:0;border-radius:14px;padding:14px 24px;"
                + "background:#0d4b39;color:white;font-size:18px;font-weight:bold}</style></head>"
                + "<body><div class='c'><h1>تعذر الاتصال بالإنترنت</h1>"
                + "<p>تحقق من الاتصال ثم حاول مرة أخرى.</p>"
                + "<button onclick=\"location.href='" + HOME_URL + "'\">إعادة المحاولة</button>"
                + "</div></body></html>";
        webView.loadDataWithBaseURL(HOME_URL, html, "text/html", "UTF-8", null);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getBooleanExtra("openPrayer", false) && webView != null) {
            webView.loadUrl(PRAYER_URL);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (waitingForExactAlarmAccess) {
            waitingForExactAlarmAccess = false;
            PrayerScheduleManager.rescheduleSaved(this);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_REQUEST && pendingGeoCallback != null) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
        } else if (requestCode == NOTIFICATION_REQUEST) {
            requestExactAlarmAccessIfNeeded();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
        }
        super.onDestroy();
    }

    private final class ShareBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public void shareWhatsApp(String message) {
            runOnUiThread(() -> shareWhatsAppMessage(message));
        }

        @JavascriptInterface
        public void openSms(String recipients, String message) {
            runOnUiThread(() -> openSmsComposer(recipients, message));
        }
    }

    private final class PrayerBridge {
        @JavascriptInterface
        public boolean isAvailable() {
            return true;
        }

        @JavascriptInterface
        public boolean isEnabled() {
            return PrayerScheduleManager.isEnabled(MainActivity.this);
        }

        @JavascriptInterface
        public void enablePrayerNotifications(String configurationJson) {
            runOnUiThread(() -> {
                PrayerScheduleManager.saveAndSchedule(MainActivity.this, configurationJson);
                requestPrayerPermissions();
            });
        }

        @JavascriptInterface
        public void disablePrayerNotifications() {
            runOnUiThread(() -> PrayerScheduleManager.disable(MainActivity.this));
        }
    }
}
