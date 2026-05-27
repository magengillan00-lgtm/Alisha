import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Alisha - مساعد AI الذكي",
  description: "محادثة ذكية مع أفاتار Live2D تفاعلي - Interactive AI Chat with Live2D Avatar",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Pre-register AssemblyAI PCM16 AudioWorklet */}
        <Script
          id="register-audio-worklet"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && window.AudioContext) {
                window.addEventListener('DOMContentLoaded', function() {
                  try {
                    var ctx = new (window.AudioContext || window.webkitAudioContext)();
                    ctx.audioWorklet.addModule('/pcm16-processor.js').then(function() {
                      console.log('PCM16 AudioWorklet registered successfully');
                      ctx.close();
                    }).catch(function(e) {
                      console.warn('PCM16 AudioWorklet registration failed:', e);
                      ctx.close();
                    });
                  } catch(e) {
                    // AudioWorklet not supported, that's fine
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />

        {/* Load Live2D SDK from CDN */}
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/browser/pixi.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="/live2d/live2dcubismcore.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
