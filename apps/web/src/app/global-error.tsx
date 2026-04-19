"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            padding: 24,
            background: "#0f172a",
            color: "#f8fafc",
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>Application error</h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: 12,
              borderRadius: 8,
              background: "#1e293b",
              fontSize: 13,
            }}
          >
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: 24, fontSize: 13, opacity: 0.85, maxWidth: 520 }}>
            Corrupt <code style={{ background: "#334155", padding: "2px 6px", borderRadius: 4 }}>.next</code> often causes a blank page or missing{" "}
            <code style={{ background: "#334155", padding: "2px 6px", borderRadius: 4 }}>.js</code> chunks. From the project root run:{" "}
            <code style={{ background: "#334155", padding: "2px 6px", borderRadius: 4 }}>npm run clean:web</code> then{" "}
            <code style={{ background: "#334155", padding: "2px 6px", borderRadius: 4 }}>npm run dev</code>.
          </p>
        </div>
      </body>
    </html>
  );
}
