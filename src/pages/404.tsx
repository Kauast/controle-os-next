export default function LegacyNotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: "32rem", textAlign: "center" }}>
        <p style={{ letterSpacing: "0.24em", textTransform: "uppercase", opacity: 0.7 }}>
          404
        </p>
        <h1 style={{ fontSize: "2rem", marginTop: "0.75rem" }}>Pagina nao encontrada</h1>
        <p style={{ marginTop: "0.75rem", opacity: 0.8 }}>
          O recurso solicitado nao existe ou foi movido.
        </p>
      </div>
    </main>
  );
}
