package com.alisha.ai;

import android.os.Bundle;
import android.os.Build;
import android.webkit.WebSettings;
import android.view.WindowManager;
import android.view.View;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "Alisha";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Allow media autoplay without user gesture in WebView
        // This is critical for TTS (text-to-speech) to work properly
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebSettings settings = getBridge().getWebView().getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                // Enable DOM storage for localStorage persistence
                settings.setDomStorageEnabled(true);
                // Enable database storage
                settings.setDatabaseEnabled(true);
                // Allow mixed content (needed for Google TTS fallback)
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                // Enable JavaScript
                settings.setJavaScriptEnabled(true);
                // Set cache mode
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                Log.d(TAG, "WebView settings configured");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error configuring WebView settings", e);
        }

        // Handle status bar properly - make it opaque so content doesn't go behind it
        // This fixes the issue where the app content covers the battery/status bar
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(android.graphics.Color.BLACK);
            getWindow().setNavigationBarColor(android.graphics.Color.BLACK);
        }

        // CRITICAL: setDecorFitsSystemWindows(true) means the system draws the decor
        // to fit the system windows, so content will NOT go behind the status bar
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        } else {
            // For pre-Android 11 devices (like Honor X6C which might be Android 10)
            // Remove any translucent flags that could cause content to go behind bars
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            // Add FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS to ensure our colors are used
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        }

        // Request microphone permission on startup
        requestMicrophonePermission();
    }

    /**
     * Request microphone permission at runtime.
     * This is required for Android 6.0+ (API 23+).
     */
    private void requestMicrophonePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Requesting RECORD_AUDIO permission");
                requestPermissions(new String[]{
                    android.Manifest.permission.RECORD_AUDIO,
                    android.Manifest.permission.WRITE_EXTERNAL_STORAGE,
                    android.Manifest.permission.READ_EXTERNAL_STORAGE,
                }, 1);
            } else {
                Log.d(TAG, "RECORD_AUDIO permission already granted");
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 1) {
            for (int i = 0; i < permissions.length; i++) {
                if (grantResults[i] == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "Permission granted: " + permissions[i]);
                } else {
                    Log.w(TAG, "Permission denied: " + permissions[i]);
                }
            }
        }
    }
}
