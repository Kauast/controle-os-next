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
      backgroundColor: "#0d0d0d",
    },
    Camera: {
      // Permite câmera traseira por padrão
    },
    Geolocation: {
      // Requisitar permissão de localização precisa
    },
    Preferences: {
      // Storage seguro nativo
    },
  },
};

export default config;
