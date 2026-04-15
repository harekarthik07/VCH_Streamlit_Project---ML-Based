"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Eye, EyeOff, AlertCircle } from "lucide-react";

const USERS = {
  admin: { password: "test@123", role: "admin" },
  user: { password: "user@123", role: "user" },
};

const DEFAULT_USERS_KEY = "vch-users";
const DEFAULT_USERS = { admin: { role: "admin" }, user: { role: "user" } };

function initDefaultUsers() {
  try {
    const existing = localStorage.getItem(DEFAULT_USERS_KEY);
    if (!existing || !JSON.parse(existing) || Object.keys(JSON.parse(existing)).length === 0) {
      localStorage.setItem(DEFAULT_USERS_KEY, JSON.stringify(DEFAULT_USERS));
    }
  } catch {
    localStorage.setItem(DEFAULT_USERS_KEY, JSON.stringify(DEFAULT_USERS));
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("vch-auth");
      if (stored) router.replace("/");
    } catch { }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 520));

    const u = USERS[username.trim().toLowerCase()];
    if (!u || u.password !== password) {
      setError("Invalid credentials. Access denied.");
      setLoading(false);
      return;
    }

    initDefaultUsers();
    window.localStorage.setItem(
      "vch-auth",
      JSON.stringify({ username: username.trim(), role: u.role })
    );
    router.push("/");
  };

  return (
      <>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Outfit', sans-serif !important; }


        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 18% -10%, rgba(0,204,150,0.22) 0%, transparent 42%),
                      radial-gradient(ellipse at 90% 95%, rgba(0,179,131,0.14) 0%, transparent 38%),
                      radial-gradient(ellipse at 60% 50%, rgba(0,0,0,0) 0%, transparent 100%),
                      linear-gradient(180deg, #0b0c10 0%, #060709 100%);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(0,204,150,0.04) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
          pointer-events: none;
        }

        .login-card {
          width: 100%;
          max-width: 460px;
          background: rgba(20, 22, 28, 0.82);
          backdrop-filter: blur(28px) saturate(140%);
          -webkit-backdrop-filter: blur(28px) saturate(140%);
          border: 1px solid rgba(255,255,255,0.09);
          border-top: 1px solid rgba(0, 204, 150, 0.38);
          border-radius: 24px;
          padding: 48px 44px 44px;
          box-shadow:
            0 0 0 1px rgba(0,204,150,0.04),
            0 32px 80px rgba(0,0,0,0.7),
            0 0 60px rgba(0,204,150,0.06);
          position: relative;
          opacity: 0;
          transform: translateY(28px);
          animation: cardIn 0.6s cubic-bezier(0.22,1,0.36,1) 0.1s forwards;
        }

        @keyframes cardIn {
          to { opacity: 1; transform: translateY(0); }
        }

        .login-card::before {
          content: '';
          position: absolute;
          top: 0; left: 50%; transform: translateX(-50%);
          width: 200px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,204,150,0.7), transparent);
        }

        .brand-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .brand-icon {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, rgba(0,204,150,0.22), rgba(0,140,100,0.12));
          border: 1px solid rgba(0,204,150,0.3);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
        }

        .brand-name {
          font-size: 22px;
          font-weight: 900;
          color: #fff;
          letter-spacing: 0.5px;
        }

        .brand-accent { color: #00cc96; }

        .login-title {
          text-align: center;
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 4px;
          letter-spacing: -0.5px;
          line-height: 1.2;
        }

        .login-sub {
          text-align: center;
          color: rgba(160,160,171,0.85);
          font-size: 14px;
          margin-bottom: 36px;
          font-weight: 400;
        }

        .form-group {
          margin-bottom: 18px;
        }

        .form-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #a0a0ab;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .input-wrap {
          position: relative;
        }

        .form-input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(10, 12, 18, 0.72);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 15px;
          font-family: 'Outfit', sans-serif;
          font-weight: 500;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }

        .form-input:focus {
          border-color: rgba(0,204,150,0.55);
          background: rgba(0, 204, 150, 0.04);
          box-shadow: 0 0 0 3px rgba(0,204,150,0.08), 0 0 20px rgba(0,204,150,0.06);
        }

        .form-input::placeholder { color: rgba(160,160,171,0.45); }

        .pw-toggle {
          position: absolute;
          right: 14px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: rgba(160,160,171,0.55);
          cursor: pointer;
          padding: 4px;
          display: flex; align-items: center;
          transition: color 0.2s;
        }
        .pw-toggle:hover { color: #00cc96; }

        .error-bar {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,75,75,0.1);
          border: 1px solid rgba(255,75,75,0.28);
          border-radius: 10px;
          padding: 11px 14px;
          color: #ff7070;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
          animation: errIn 0.25s ease;
        }

        @keyframes errIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .submit-btn {
          width: 100%;
          padding: 15px 20px;
          background: linear-gradient(135deg, #00cc96 0%, #00a87c 100%);
          color: #071a14;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 900;
          font-family: 'Outfit', sans-serif;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
          position: relative;
          overflow: hidden;
          margin-top: 8px;
        }

        .submit-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0,204,150,0.38), 0 0 0 1px rgba(0,204,150,0.2);
          background: linear-gradient(135deg, #00e6aa 0%, #00cc96 100%);
        }

        .submit-btn:not(:disabled):active { transform: translateY(1px); }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-btn .btn-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
          transform: translateX(-100%);
          animation: shimmer 1.4s infinite;
        }

        @keyframes shimmer {
          to { transform: translateX(100%); }
        }

        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
          margin: 28px 0;
        }

        .hint-row {
          display: flex; gap: 10px; flex-wrap: wrap;
        }

        .hint-chip {
          flex: 1; min-width: 140px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hint-chip:hover {
          background: rgba(0,204,150,0.06);
          border-color: rgba(0,204,150,0.22);
        }

        .hint-role {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #00cc96;
          margin-bottom: 2px;
        }

        .hint-cred {
          font-size: 12px;
          color: rgba(160,160,171,0.7);
          font-weight: 500;
        }

        .bottom-note {
          text-align: center;
          margin-top: 24px;
          font-size: 11px;
          color: rgba(160,160,171,0.38);
          letter-spacing: 0.5px;
        }
      `}</style>

      <div className="login-root">
        <div className="login-card">
          <div className="brand-row">
            <div className="brand-icon">
              <Zap size={20} color="#00cc96" />
            </div>
            <span className="brand-name">
              VCH <span className="brand-accent">Systems</span>
            </span>
          </div>

          <div className="login-title">Thermal Suite V4</div>
          <div className="login-sub">Sign in to access the analytics platform</div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrap">
                <input
                  className="form-input"
                  type={showPw ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-bar">
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading && <span className="btn-shimmer" />}
              {loading ? "Authenticating…" : "Authenticate Access"}
            </button>
          </form>

          <div className="divider" />

          <div className="hint-row">
            {[
              { role: "Admin", user: "admin", pw: "test@123" },
              { role: "User", user: "user", pw: "user@123" },
            ].map((h) => (
              <button
                key={h.role}
                className="hint-chip"
                type="button"
                onClick={() => { setUsername(h.user); setPassword(h.pw); setError(""); }}
              >
                <div className="hint-role">{h.role}</div>
                <div className="hint-cred">{h.user}</div>
              </button>
            ))}
          </div>

          <div className="bottom-note">
            Raptee.HV Engineering Systems · Thermal Analytics Engine
          </div>
        </div>
      </div>
    </>
  );
}