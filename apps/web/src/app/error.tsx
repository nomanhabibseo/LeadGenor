"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "#0f172a",
        color: "#f8fafc",
      }}
    >
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Something went wrong</h1>
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
      {error.digest ? <p style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>Digest: {error.digest}</p> : null}
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
      <p style={{ marginTop: 24, fontSize: 13, opacity: 0.85 }}>
        If the app stays broken, stop the dev server, run <code style={{ background: "#334155", padding: "2px 6px", borderRadius: 4 }}>npm run clean:web</code> from the repo root, then{" "}
        <code style={{ background: "#334155", padding: "2px 6px", borderRadius: 4 }}>npm run dev</code> again.
      </p>
    </div>
  );
}
