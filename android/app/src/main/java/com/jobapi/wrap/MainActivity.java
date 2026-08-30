package com.jobapi.wrap;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://kimhyunjun0415.github.io/job-api/";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // target="_blank" 링크/window.open()을 감지해서 아래 onCreateWindow로 넘기려면 필요.
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            // 웹페이지에서 window.close()를 호출하면 여기로 들어와서 앱을 종료시킨다.
            // (메인 화면의 방문 기록이 남아있으면 브라우저 정책상 이 콜백 자체가 안 불린다 -
            // 그래서 새 탭 링크를 절대 메인 웹뷰 히스토리에 남기지 않는 게 중요하다.)
            @Override
            public void onCloseWindow(WebView window) {
                finish();
            }

            // target="_blank" 링크나 window.open()이 호출되면 메인 웹뷰를 그 페이지로
            // 이동시키는 대신, 임시 웹뷰로 목적지 URL만 가로채서 폰 기본 브라우저로 넘긴다.
            // 이렇게 해야 메인 화면 히스토리가 절대 쌓이지 않아서 종료 버튼이 항상 동작한다.
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView tempWebView = new WebView(MainActivity.this);
                tempWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String url) {
                        openInBrowser(url);
                        return true;
                    }

                    @Override
                    public void onPageStarted(WebView v, String url, Bitmap favicon) {
                        openInBrowser(url);
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(tempWebView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        }
    }

    private void openInBrowser(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
            // 열 수 있는 브라우저가 없는 등 예외 상황은 조용히 무시.
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
}
