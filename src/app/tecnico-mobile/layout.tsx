import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Guardião — App Técnico",
  description: "App mobile para técnicos de campo.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Guardião",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0d0d0d",
};

export default function TecnicoMobileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
