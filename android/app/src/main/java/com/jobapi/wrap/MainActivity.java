package com.jobapi.wrap;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://kimhyunjun0415.github.io/job-api/";

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        // 웹페이지의 종료 버튼이 window.close() 대신 이 브릿지를 우선 호출한다.
        // (window.close()는 브라우저 스펙상 방문 기록이 쌓이면 막히지만, 이 방식은
        // 그냥 네이티브 메서드 호출이라 언제 눌러도 항상 동작한다.)
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidApp");

        // 모든 링크(새 탭 링크 포함)를 앱 안의 이 웹뷰 안에서 그대로 연다.
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
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

    private class AndroidBridge {
        @JavascriptInterface
        public void closeApp() {
            runOnUiThread(MainActivity.this::finish);
        }
    }
}
