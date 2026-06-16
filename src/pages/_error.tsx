import type { NextPageContext } from "next";

type ErrorPageProps = {
  statusCode?: number;
};

function ErrorPage({ statusCode = 500 }: ErrorPageProps) {
  const title = statusCode === 404 ? "Pagina nao encontrada" : "Erro interno";
  const description =
    statusCode === 404
      ? "O recurso solicitado nao existe ou foi movido."
      : "Ocorreu uma falha inesperada ao carregar esta tela.";

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
          {statusCode}
        </p>
        <h1 style={{ fontSize: "2rem", marginTop: "0.75rem" }}>{title}</h1>
        <p style={{ marginTop: "0.75rem", opacity: 0.8 }}>{description}</p>
      </div>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorPageProps => {
  if (res?.statusCode) {
    return { statusCode: res.statusCode };
  }

  if (err && "statusCode" in err && typeof err.statusCode === "number") {
    return { statusCode: err.statusCode };
  }

  return { statusCode: 500 };
};

export default ErrorPage;
