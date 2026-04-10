"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("vch-auth");
    if (stored) router.replace("/");
  }, [router]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    window.localStorage.setItem(
      "vch-auth",
      JSON.stringify({ username: username.trim(), role: username.trim() === "admin" ? "admin" : "user" })
    );
    router.push("/");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 32,
      }}
    >
      <div
        className="surface-panel"
        style={{
          width: "100%",
          maxWidth: 520,
          padding: "40px 36px",
          background: "linear-gradient(180deg, rgba(32,36,45,0.92), rgba(20,22,28,0.94))",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 8 }}>
            VCH <span style={{ color: "var(--primary-accent)" }}>Thermal Dashboard</span>
          </div>
          <div style={{ color: "var(--text-sub)", fontSize: 15 }}>
            Sign in to access the master application and evaluation suites.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "var(--text-title)", fontSize: 13, fontWeight: 600 }}>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                background: "rgba(10, 12, 18, 0.58)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                padding: "14px 16px",
                color: "#fff",
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "var(--text-title)", fontSize: 13, fontWeight: 600 }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                background: "rgba(10, 12, 18, 0.58)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                padding: "14px 16px",
                color: "#fff",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: 8,
              padding: "14px 18px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(90deg, #00cc96, #00b383)",
              color: "#09110f",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Authenticate Access
          </button>
        </form>
      </div>
    </main>
  );
}
