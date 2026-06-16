"use client";

export default function GlobalError() {
  return (
    <html lang="pt-BR">
      <body>
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md text-center">
            <p className="text-sm uppercase tracking-[0.24em] text-muted">500</p>
            <h1 className="mt-3 text-3xl font-semibold text-ink">Erro interno</h1>
            <p className="mt-2 text-sm text-muted">
              Ocorreu uma falha inesperada ao carregar esta tela.
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
