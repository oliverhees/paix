"use client";

import { useEffect } from "react";

/**
 * global-error.tsx — catches errors in the root layout itself.
 * Must wrap html+body since the root layout is broken when this renders.
 * Uses only inline styles (no Tailwind/CSS, as those may not be available).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="de">
      <body
        style={{
          backgroundColor: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: "16px",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>
            Etwas ist schiefgelaufen
          </h2>
          <p style={{ fontSize: "14px", color: "#a1a1aa", margin: 0 }}>
            {error.message || "Ein unerwarteter Fehler ist aufgetreten."}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              border: "1px solid #3f3f46",
              borderRadius: "6px",
              background: "transparent",
              color: "#fafafa",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
