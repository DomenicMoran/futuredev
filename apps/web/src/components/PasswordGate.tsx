"use client";

import { useState, useEffect, useCallback } from "react";

const AUTH_COOKIE = "futuredev_auth";
const PASSWORD = "DomenicDev";

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function hashPassword(pw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pw);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PasswordGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkAuth = useCallback(async () => {
    const stored = getCookie(AUTH_COOKIE);
    if (stored) {
      const expected = await hashPassword(PASSWORD);
      if (stored === expected) {
        setAuthed(true);
        return;
      }
    }
    setAuthed(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    // Small delay to prevent brute-force
    await new Promise((r) => setTimeout(r, 300));

    if (input === PASSWORD) {
      const hash = await hashPassword(PASSWORD);
      setCookie(AUTH_COOKIE, hash, 30);
      setAuthed(true);
    } else {
      setError(true);
      setInput("");
    }
    setLoading(false);
  };

  if (authed === null) {
    return (
      <div className="gate-loading">
        <div className="gate-spinner" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="gate">
        <div className="gate-card">
          <div className="gate-logo">
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="48" height="48" rx="12" fill="#3b82f6" />
              <path
                d="M14 32V16l10 8-10 8ZM24 32V16l10 8-10 8Z"
                fill="#fff"
              />
            </svg>
          </div>
          <h1>FutureDev</h1>
          <p>Gib das Passwort ein, um fortzufahren.</p>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(false);
              }}
              placeholder="Passwort"
              className={`gate-input ${error ? "gate-input--error" : ""}`}
              autoFocus
              disabled={loading}
            />
            {error && (
              <span className="gate-error">Falsches Passwort.</span>
            )}
            <button
              type="submit"
              className="btn btn-primary gate-btn"
              disabled={loading || input.length === 0}
            >
              {loading ? "Prüfe…" : "Weiter"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}