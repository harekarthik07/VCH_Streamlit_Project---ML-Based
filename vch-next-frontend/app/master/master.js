"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import {
    Rocket, Settings, Route, Users, Monitor,
    ShieldCheck, Trash2, Plus, X, LogOut,
    CheckCircle, XCircle, Clock, Activity,
} from "lucide-react";

/* ─── tiny in-memory session store ─────────────────────────────────────────── */
const USERS_KEY = "vch-users";
const SESSIONS_KEY = "vch-sessions";

function getUsers() {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        return raw ? JSON.parse(raw) : { admin: { role: "admin" }, user: { role: "user" } };
    } catch { return {}; }
}

function saveUsers(u) {
    localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

function getSessions() {
    try {
        const raw = localStorage.getItem(SESSIONS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function saveSessions(s) {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(s));
}

/* ─── main component ─────────────────────────────────────────────────────── */
export default function DashboardHome() {
    const router = useRouter();
    const [authState, setAuthState] = useState({ username: "", role: "", ready: false });
    const [adminTab, setAdminTab] = useState("users");

    // user management
    const [users, setUsers] = useState({});
    const [sessions, setSessions] = useState({});
    const [newU, setNewU] = useState("");
    const [newP, setNewP] = useState("");
    const [newR, setNewR] = useState("user");
    const [userMsg, setUserMsg] = useState(null);

    /* hydrate auth */
    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem("vch-auth");
        if (!stored) { router.replace("/login"); return; }
        try {
            const parsed = JSON.parse(stored);
            setAuthState({ username: parsed.username || "admin", role: parsed.role || "user", ready: true });

            // seed a session entry for this user if missing
            const sess = getSessions();
            const sid = parsed.username + "-session";
            if (!sess[sid]) {
                sess[sid] = {
                    username: parsed.username,
                    login_time: new Date().toLocaleString(),
                    status: "active",
                };
                saveSessions(sess);
            }
            setSessions(getSessions());
            setUsers(getUsers());
        } catch {
            router.replace("/login");
        }
    }, [router]);

    if (!authState.ready) return null;

    /* ── helpers ── */
    const refreshAdmin = () => { setUsers(getUsers()); setSessions(getSessions()); };

    const createUser = () => {
        if (!newU.trim() || !newP.trim()) { setUserMsg({ type: "err", text: "Username and password required." }); return; }
        const u = getUsers();
        if (u[newU]) { setUserMsg({ type: "err", text: "Username already exists." }); return; }
        u[newU] = { role: newR };
        saveUsers(u);
        setNewU(""); setNewP("");
        setUserMsg({ type: "ok", text: `User "${newU}" created.` });
        refreshAdmin();
    };

    const deleteUser = (username) => {
        if (username === "admin") { setUserMsg({ type: "err", text: "Cannot delete admin." }); return; }
        const u = getUsers(); delete u[username]; saveUsers(u);
        setUserMsg({ type: "ok", text: `User "${username}" deleted.` });
        refreshAdmin();
    };

    const terminateSession = (sid) => {
        const s = getSessions(); s[sid].status = "terminated"; saveSessions(s);
        refreshAdmin();
    };

    /* ── card data ── */
    const cards = [
        {
            title: "Dyno Suite",
            icon: <Settings size={42} style={{ color: "#c8d8cc" }} />,
            href: "/dyno",
            cta: "Launch Dyno Engine",
            badge: "QC Gatekeeper",
            badgeColor: "#00cc96",
            description:
                "Strict Quality Control engine that evaluates stationary Dewesoft telemetry against mathematically calculated Golden Standards.",
            features: [
                { label: "Statistical Envelopes", desc: "Automated ±2-Sigma boundaries across all channels." },
                { label: "QC Gatekeeper", desc: "Dynamic power & early deration tracking." },
                { label: "Automated Docs", desc: "1-Click Executive Word Report generator." },
            ],
            accent: "rgba(0,204,150,0.1)",
            accentBorder: "rgba(0,204,150,0.28)",
        },
        {
            title: "Road Suite",
            icon: <Route size={42} style={{ color: "#c8d2e8" }} />,
            href: "/road",
            cta: "Launch Road Engine",
            badge: "ML Enabled",
            badgeColor: "#ab63fa",
            description:
                "Dynamic telemetry processing engine for raw CAN bus logs — visualizes real-world powertrain performance and battery efficiency.",
            features: [
                { label: "Universal Decoder", desc: "Raw CAN & Excel to 2Hz time-series." },
                { label: "Battery Analytics", desc: "SOC drain & bracketed Wh/km tracking." },
                { label: "Thermal Protection", desc: "Motor torque vs. deration overlay maps." },
            ],
            accent: "rgba(171,99,250,0.08)",
            accentBorder: "rgba(171,99,250,0.24)",
        },
    ];

    const isAdmin = authState.role === "admin";

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

        .master-root * { box-sizing: border-box; }
        .master-root { font-family: 'Outfit', sans-serif; }

        /* nav cards */
        .nav-card {
          background: rgba(20, 22, 28, 0.54);
          border: 1px solid rgba(255,255,255,0.08);
          border-top: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px;
          padding: 36px 30px 28px;
          transition: all 0.38s cubic-bezier(0.4,0,0.2,1);
          display: flex; flex-direction: column;
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          position: relative;
          overflow: hidden;
        }
        .nav-card::after {
          content: '';
          position: absolute; inset: 0;
          background: var(--card-hover-bg, transparent);
          transition: background 0.38s ease;
          pointer-events: none; border-radius: 20px;
        }
        .nav-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px var(--card-accent-border);
          border-top-color: var(--card-accent-border) !important;
        }

        .feature-item {
          display: flex; gap: 12px; padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .feature-item:last-child { border-bottom: none; padding-bottom: 0; }
        .feature-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #00cc96; margin-top: 7px; flex-shrink: 0;
        }

        /* pill button */
        .pill-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 22px; border-radius: 10px; text-decoration: none;
          font-weight: 800; font-size: 14px; font-family: 'Outfit', sans-serif;
          transition: all 0.25s ease; border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06); color: #FFF; cursor: pointer;
        }
        .pill-btn:hover {
          background: rgba(0,204,150,0.18);
          border-color: rgba(0,204,150,0.4);
          color: #00cc96;
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(0,204,150,0.15);
        }

        /* admin zone */
        .admin-tab {
          padding: 9px 18px; border-radius: 8px; cursor: pointer;
          border: 1px solid transparent; font-size: 13px; font-weight: 700;
          background: transparent; color: rgba(160,160,171,0.7);
          transition: all 0.2s; font-family: 'Outfit', sans-serif;
          display: flex; align-items: center; gap: 7px;
        }
        .admin-tab.active {
          background: rgba(0,204,150,0.12);
          border-color: rgba(0,204,150,0.28);
          color: #00cc96;
        }
        .admin-tab:hover:not(.active) {
          color: #FFF; background: rgba(255,255,255,0.04);
        }

        .user-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border-radius: 10px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 8px; transition: background 0.2s;
        }
        .user-row:hover { background: rgba(255,255,255,0.04); }

        .session-row {
          display: grid;
          grid-template-columns: 160px 1fr 160px auto;
          align-items: center; gap: 12px;
          padding: 12px 16px; border-radius: 10px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.06);
          margin-bottom: 8px;
        }

        .form-inp {
          background: rgba(10,12,18,0.7);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 11px 14px;
          color: #FFF; font-size: 13px; font-family: 'Outfit', sans-serif;
          outline: none; width: 100%; transition: border-color 0.2s;
        }
        .form-inp:focus { border-color: rgba(0,204,150,0.45); }

        .role-sel {
          background: rgba(10,12,18,0.7);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 11px 14px;
          color: #FFF; font-size: 13px; font-family: 'Outfit', sans-serif;
          outline: none; cursor: pointer;
        }

        .act-btn {
          padding: 8px 16px; border-radius: 8px; cursor: pointer;
          font-size: 12px; font-weight: 700; font-family: 'Outfit', sans-serif;
          border: 1px solid; transition: all 0.2s;
        }

        .msg-ok  { color: #00cc96; background: rgba(0,204,150,0.08); border-color: rgba(0,204,150,0.25); border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }
        .msg-err { color: #FF6B6B; background: rgba(255,75,75,0.08); border-color: rgba(255,75,75,0.25); border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600; margin-bottom: 12px; }

        .status-dot {
          width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px;
        }
        .status-dot.active { background: #00cc96; box-shadow: 0 0 6px #00cc96; }
        .status-dot.terminated { background: #FF4B4B; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-item { animation: fadeUp 0.5s ease both; }
      `}</style>

            <div className="master-root app-container">
                <Sidebar />

                <main className="main-content">

                    {/* ── Header ─────────────────────────────────────────── */}
                    <div className="fade-in" style={{ marginBottom: 30 }}>
                        {/* Logo block */}
                        <div style={{
                            width: 160, height: 52,
                            background: "linear-gradient(135deg, rgba(255,255,255,0.94), rgba(220,220,220,0.88))",
                            borderRadius: 10, display: "flex", alignItems: "center",
                            justifyContent: "center", marginBottom: 24,
                        }}>
                            <span style={{ fontWeight: 900, fontSize: 22, color: "#111", letterSpacing: 1 }}>RAPTEE</span>
                        </div>

                        <h1 style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-1.5px", marginBottom: 8, lineHeight: 1.1 }}>
                            Raptee Thermal Suite
                        </h1>
                        <div style={{ fontSize: 17, fontWeight: 700, color: "#00cc96", marginBottom: 10 }}>
                            Thermal & Dynamics Analytics Engine V4
                        </div>
                        <div style={{ color: "var(--text-sub)", fontSize: 14 }}>
                            Logged in as:{" "}
                            <span style={{ color: "#00cc96", fontWeight: 700 }}>{authState.username}</span>
                            {isAdmin && (
                                <span style={{
                                    marginLeft: 10, fontSize: 11, fontWeight: 800, textTransform: "uppercase",
                                    background: "rgba(0,204,150,0.12)", border: "1px solid rgba(0,204,150,0.28)",
                                    color: "#00cc96", padding: "3px 8px", borderRadius: 6, letterSpacing: 1,
                                }}>Admin</span>
                            )}
                        </div>
                    </div>

                    <hr className="soft-divider" />

                    {/* ── Active Environments heading ───────────────────── */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <Rocket size={22} color="#ff8a5b" />
                        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Active Testing Environments</h2>
                    </div>
                    <p className="section-subtitle" style={{ marginBottom: 24 }}>
                        Select a module below or use the sidebar to launch dedicated evaluation suites.
                    </p>

                    {/* ── Nav Cards ─────────────────────────────────────── */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
                        {cards.map((card, i) => (
                            <div
                                key={card.href}
                                className="nav-card fade-item"
                                style={{
                                    "--card-accent-border": card.accentBorder,
                                    "--card-hover-bg": card.accent,
                                    animationDelay: `${i * 0.08}s`,
                                }}
                            >
                                {/* badge */}
                                <div style={{ position: "absolute", top: 18, right: 20 }}>
                                    <span style={{
                                        fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                        letterSpacing: 1, padding: "4px 9px", borderRadius: 6,
                                        background: `${card.badgeColor}18`,
                                        border: `1px solid ${card.badgeColor}44`,
                                        color: card.badgeColor,
                                    }}>{card.badge}</span>
                                </div>

                                <div style={{ marginBottom: 18 }}>{card.icon}</div>
                                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>{card.title}</div>
                                <div style={{ color: "var(--text-sub)", fontSize: 14, lineHeight: 1.65, marginBottom: 20 }}>
                                    {card.description}
                                </div>

                                <div style={{ flex: 1, marginBottom: 24 }}>
                                    {card.features.map((f) => (
                                        <div key={f.label} className="feature-item">
                                            <div className="feature-dot" />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>{f.label}</div>
                                                <div style={{ fontSize: 12, color: "var(--text-sub)", marginTop: 1 }}>{f.desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <Link className="pill-btn" href={card.href} style={{ alignSelf: "flex-start" }}>
                                    {card.cta}
                                </Link>
                            </div>
                        ))}
                    </div>

                    {/* ── Admin Zone ────────────────────────────────────── */}
                    {isAdmin && (
                        <div style={{
                            background: "rgba(16,18,24,0.72)",
                            border: "1px solid rgba(255,215,0,0.2)",
                            borderTop: "2px solid rgba(255,215,0,0.5)",
                            borderRadius: 20,
                            padding: "28px 30px",
                            backdropFilter: "blur(18px)",
                        }}>
                            {/* header */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                                <ShieldCheck size={20} color="#FFD700" />
                                <h3 style={{ fontSize: 17, fontWeight: 800, color: "#FFD700" }}>Administration Zone</h3>
                            </div>

                            {/* tab bar */}
                            <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                                {[
                                    { id: "users", label: "User Management", icon: <Users size={14} /> },
                                    { id: "sessions", label: "Active Sessions", icon: <Monitor size={14} /> },
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        className={`admin-tab ${adminTab === t.id ? "active" : ""}`}
                                        onClick={() => { setAdminTab(t.id); refreshAdmin(); setUserMsg(null); }}
                                    >
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>

                            {/* ── Users tab ── */}
                            {adminTab === "users" && (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
                                    {/* current users */}
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-title)", marginBottom: 14 }}>
                                            System Users
                                        </div>
                                        {Object.entries(users).map(([uname, udata]) => (
                                            <div key={uname} className="user-row">
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{uname}</div>
                                                    <div style={{ fontSize: 11, color: "#00cc96", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                                                        {udata.role}
                                                    </div>
                                                </div>
                                                {uname !== "admin" && (
                                                    <button
                                                        className="act-btn"
                                                        onClick={() => deleteUser(uname)}
                                                        style={{ borderColor: "rgba(255,75,75,0.35)", color: "#FF6B6B", background: "rgba(255,75,75,0.06)" }}
                                                    >
                                                        <Trash2 size={12} style={{ display: "inline", marginRight: 4 }} />
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* create user */}
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-title)", marginBottom: 14 }}>
                                            Add New User
                                        </div>
                                        {userMsg && (
                                            <div className={userMsg.type === "ok" ? "msg-ok" : "msg-err"}>
                                                {userMsg.text}
                                            </div>
                                        )}
                                        <div style={{ display: "grid", gap: 10 }}>
                                            <input
                                                className="form-inp"
                                                placeholder="New username"
                                                value={newU}
                                                onChange={(e) => setNewU(e.target.value)}
                                            />
                                            <input
                                                className="form-inp"
                                                type="password"
                                                placeholder="Password"
                                                value={newP}
                                                onChange={(e) => setNewP(e.target.value)}
                                            />
                                            <select className="role-sel" value={newR} onChange={(e) => setNewR(e.target.value)}>
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <button
                                                className="act-btn"
                                                onClick={createUser}
                                                style={{
                                                    borderColor: "rgba(0,204,150,0.35)", color: "#00cc96",
                                                    background: "rgba(0,204,150,0.08)", padding: "11px 18px",
                                                }}
                                            >
                                                <Plus size={13} style={{ display: "inline", marginRight: 5 }} />
                                                Create User
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Sessions tab ── */}
                            {adminTab === "sessions" && (
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-title)", marginBottom: 14 }}>
                                        Monitor and terminate active connections
                                    </div>

                                    {/* header row */}
                                    <div style={{
                                        display: "grid", gridTemplateColumns: "160px 1fr 160px 130px",
                                        padding: "8px 16px", gap: 12,
                                        fontSize: 10, fontWeight: 800, textTransform: "uppercase",
                                        letterSpacing: 1, color: "var(--text-sub)", marginBottom: 4,
                                    }}>
                                        <span>Visitor</span><span>Session ID</span><span>Login Time</span><span>Action</span>
                                    </div>

                                    {Object.entries(sessions).length === 0 && (
                                        <div style={{ color: "var(--text-sub)", fontSize: 13, padding: "16px 0" }}>
                                            No active sessions found.
                                        </div>
                                    )}

                                    {Object.entries(sessions).map(([sid, data]) => (
                                        <div key={sid} className="session-row">
                                            <div style={{ display: "flex", alignItems: "center" }}>
                                                <span
                                                    className={`status-dot ${data.status === "active" ? "active" : "terminated"}`}
                                                />
                                                <span style={{ fontSize: 13, fontWeight: 700 }}>{data.username}</span>
                                            </div>
                                            <code style={{ fontSize: 11, color: "var(--text-sub)", background: "rgba(255,255,255,0.04)", padding: "4px 8px", borderRadius: 6 }}>
                                                {sid.slice(0, 16)}…
                                            </code>
                                            <div style={{ fontSize: 12, color: "var(--text-sub)" }}>{data.login_time}</div>
                                            {data.status === "active" ? (
                                                <button
                                                    className="act-btn"
                                                    onClick={() => terminateSession(sid)}
                                                    style={{ borderColor: "rgba(255,75,75,0.35)", color: "#FF6B6B", background: "rgba(255,75,75,0.06)", whiteSpace: "nowrap" }}
                                                >
                                                    <X size={11} style={{ display: "inline", marginRight: 4 }} />
                                                    Terminate
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: 11, color: "#FF4B4B", fontWeight: 700 }}>Terminated</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Footer ───────────────────────────────────────── */}
                    <div style={{
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        marginTop: 48, paddingTop: 24,
                        textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 12,
                    }}>
                        Raptee.HV Engineering Systems · Developed for VCH Analysis
                    </div>
                </main>
            </div>
        </>
    );
}