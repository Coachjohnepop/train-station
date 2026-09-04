"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" style={{ backgroundColor: "#0a0612" }}>
      <body
        style={{
          minHeight: "100dvh",
          margin: 0,
          background: "#0a0612",
          color: "#f2ecf9",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ fontWeight: 600 }}>Couldn’t open The Train Station.</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            borderRadius: 999,
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            padding: "10px 20px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
