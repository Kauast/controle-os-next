import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.guardiaotech.controleos",
  appName: "Guardião",
  webDir: "out-mobile",
  server: {
    androidScheme: "https",
    hostname: "app.guardiao",
    cleartext: false,
  },
  android: {
    buildOptions: {
      signingType: "apksigner",
    },
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
