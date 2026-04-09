"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    if (error) Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "'Outfit', sans-serif", background: "#080b14", color: "#f0ede8", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0, padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 24, lineHeight: 1.6 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={() => reset()}
            style={{ padding: "12px 28px", borderRadius: 10, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            Try Again
          </button>
          <div style={{ marginTop: 16 }}>
            <a href="/" style={{ fontSize: 14, color: "#c47d8e", textDecoration: "none" }}>← Back to home</a>
          </div>
        </div>
      </body>
    </html>
  );
}
