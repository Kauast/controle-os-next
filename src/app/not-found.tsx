export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-muted">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Pagina nao encontrada</h1>
        <p className="mt-2 text-sm text-muted">
          O recurso solicitado nao existe ou foi movido.
        </p>
      </div>
    </main>
  );
}
