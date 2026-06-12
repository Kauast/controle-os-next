"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TecnicoMobilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tecnico");
  }, [router]);

  return (
    <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">
      Redirecionando para o app tecnico...
    </div>
  );
}
