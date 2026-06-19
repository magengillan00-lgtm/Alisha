import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // ✅ إزالة ignoreBuildErrors لكشف الأخطاء الحقيقية
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // ✅ النطاق المخصص alisha.dpdns.org لا يحتاج basePath
  // إذا أردت النشر على github.io/Alisha/ أضف: basePath: "/Alisha"
  trailingSlash: true,
};

export default nextConfig;
