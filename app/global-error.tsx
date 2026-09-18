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
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#101010", color: "#ECECEC", padding: 48 }}>
        <h1>Whatafeat hit a wall.</h1>
        <p style={{ color: "#A0A0A0" }}>
          {error.digest ? `Reference: ${error.digest}` : "Reload and try again."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            background: "#ECECEC",
            color: "#101010",
            border: 0,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
