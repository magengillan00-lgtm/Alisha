import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "أليشا - مساعدتك الذكية",
  description: "مساعدة ذكية شخصية تتحدث العربية والإنجليزية مع تعرف على الكلام في الوقت الحقيقي",
  keywords: ["Alisha", "AI", "مساعد ذكي", "Arabic AI", "Speech Recognition", "AssemblyAI"],
  authors: [{ name: "Alisha Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "أليشا - مساعدتك الذكية",
    description: "مساعدة ذكية شخصية تتحدث العربية والإنجليزية",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
