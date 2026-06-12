"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TecnicoMobileLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/tecnico/login");
  }, [router]);

  return (
    <div className="grid min-h-[100dvh] place-items-center text-sm text-muted-foreground">
      Redirecionando para o login do tecnico...
    </div>
  );
}
