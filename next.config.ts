import type { NextConfig } from "next";

const repo = "Alisha";

const nextConfig: NextConfig = {
  output: "export",
  // ✅ إزالة ignoreBuildErrors لكشف الأخطاء الحقيقية
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // GitHub Pages serves at https://<user>.github.io/<repo>/
  basePath: `/${repo}`,
  assetPrefix: `/${repo}/`,
  trailingSlash: true,
};

export default nextConfig;
