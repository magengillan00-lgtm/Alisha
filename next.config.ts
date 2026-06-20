import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // ✅ إزالة ignoreBuildErrors لكشف الأخطاء الحقيقية
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // ✅ النطاق المخصص alisha.dpdns.org لا يحتاج basePath
  trailingSlash: true,
  // ✅ تعريف env vars صراحةً ليُضمَّن في الـ client bundle
  env: {
    NEXT_PUBLIC_OPENROUTER_KEY: process.env.NEXT_PUBLIC_OPENROUTER_KEY || '',
    NEXT_PUBLIC_NVIDIA_KEY: process.env.NEXT_PUBLIC_NVIDIA_KEY || '',
    NEXT_PUBLIC_ABLITERATION_KEY: process.env.NEXT_PUBLIC_ABLITERATION_KEY || '',
    NEXT_PUBLIC_HUGGINGFACE_KEY: process.env.NEXT_PUBLIC_HUGGINGFACE_KEY || '',
    NEXT_PUBLIC_GEMINI_KEY: process.env.NEXT_PUBLIC_GEMINI_KEY || '',
    NEXT_PUBLIC_ZAI_KEY: process.env.NEXT_PUBLIC_ZAI_KEY || '',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
};

export default nextConfig;
