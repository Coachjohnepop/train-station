"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
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
      <p style={{ fontWeight: 600 }}>Couldn’t open this page.</p>
      <p style={{ fontSize: 14, color: "#9d8ab8" }}>
        {error.message || "Try again in a moment."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          marginTop: 8,
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
    </div>
  );
}
