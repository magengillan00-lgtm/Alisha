package com.alisha.ai;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.webkit.WebSettings;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Allow media autoplay without user gesture in WebView
        // This is critical for TTS (text-to-speech) to work properly
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebSettings settings = getBridge().getWebView().getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Make the status bar opaque with a dark color so the WebView content
        // doesn't overlap with the battery/status bar area
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(android.graphics.Color.BLACK);
            getWindow().setNavigationBarColor(android.graphics.Color.BLACK);
        }

        // Ensure the WebView doesn't draw behind the system bars
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // For pre-Android 11, use the flags approach
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        }
    }
}
