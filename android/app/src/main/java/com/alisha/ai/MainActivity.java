package com.alisha.ai;

import android.os.Bundle;
import android.webkit.WebSettings;

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
            // Log but don't crash if WebView isn't ready yet
            e.printStackTrace();
        }
    }
}
