import type { NextConfig } from "next";

// Config exclusivo para o build mobile (Capacitor/APK).
// Nunca altere next.config.ts com output:"export" — isso quebraria o deploy web.
const mobileConfig: NextConfig = {
  output: "export",
  distDir: "out-mobile",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default mobileConfig;
