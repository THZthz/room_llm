import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section
        style={{
          maxWidth: 720,
          width: "100%",
          background: "rgba(255, 255, 255, 0.72)",
          borderRadius: 28,
          padding: 32,
          border: "1px solid rgba(15, 118, 110, 0.12)",
          boxShadow: "0 24px 80px rgba(15, 23, 42, 0.10)"
        }}
      >
        <p style={{ margin: 0, color: "#0f766e", fontWeight: 700 }}>Room LLM Control</p>
        <h1 style={{ marginTop: 12, marginBottom: 12, fontSize: "clamp(2rem, 4vw, 3.4rem)" }}>
          One server. Multiple clients. Shared visibility.
        </h1>
        <p style={{ marginTop: 0, marginBottom: 24, color: "#475569", lineHeight: 1.6 }}>
          Open the client view on participant devices and the admin view on the server screen. All LLM access is proxied through the server.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/client" style={{ padding: "14px 20px", borderRadius: 999, background: "#0f766e", color: "white", textDecoration: "none", fontWeight: 700 }}>
            Open client view
          </Link>
          <Link href="/admin" style={{ padding: "14px 20px", borderRadius: 999, background: "#f97316", color: "white", textDecoration: "none", fontWeight: 700 }}>
            Open admin view
          </Link>
        </div>
      </section>
    </main>
  );
}
