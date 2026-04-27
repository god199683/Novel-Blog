import type { NextConfig } from "next";

// GitHub Pages project page lives at https://<user>.github.io/<repo>/
// so we need basePath = '/<repo>' so that asset URLs are correct.
const repoBase = "/Novel-Blog";

const nextConfig: NextConfig = {
  output: "export",
  basePath: repoBase,
  assetPrefix: repoBase,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
