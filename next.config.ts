import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
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
  // ✅ إضافة generateBuildId لتغيير hash مع كل build (يجبر المتصفح على تحميل الكود الجديد)
  generateBuildId: () => Date.now().toString(),
};

export default nextConfig;
