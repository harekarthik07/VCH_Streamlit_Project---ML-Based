"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import {
  Rocket, Settings, Route, Monitor,
  ShieldCheck, Trash2, Plus, X, Activity,
  Users as UsersIcon, UploadCloud
} from "lucide-react";

const USERS_KEY = "vch-users";
const SESSIONS_KEY = "vch-sessions";

const DEFAULT_USERS = { admin: { role: "admin" }, user: { role: "user" } };

function getUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || Object.keys(parsed).length === 0) {
      saveUsers(DEFAULT_USERS);
      return DEFAULT_USERS;
    }
    return parsed;
  } catch {
    saveUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  }
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

export default function MasterDashboard() {
  const router = useRouter();
  const [authState, setAuthState] = useState({ username: "", role: "", ready: false });
  const [adminTab, setAdminTab] = useState("users");
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [sessions, setSessions] = useState({});
  const [newU, setNewU] = useState("");
  const [newP, setNewP] = useState("");
  const [newR, setNewR] = useState("user");
  const [userMsg, setUserMsg] = useState(null);
  const [adminExpanded, setAdminExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("vch-auth");
    if (!stored) { router.replace("/login"); return; }
    try {
      const parsed = JSON.parse(stored);
      setAuthState({ username: parsed.username || "admin", role: parsed.role || "user", ready: true });

      const sess = getSessions();
      const sid = parsed.username + "-session";
      if (!sess[sid]) {
        sess[sid] = { username: parsed.username, login_time: new Date().toLocaleString(), status: "active" };
        saveSessions(sess);
      }
      setSessions(getSessions());
      setUsers(getUsers());
    } catch {
      router.replace("/login");
    }
  }, [router]);

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
    const s = getSessions();
    if (s[sid]) { s[sid].status = "terminated"; saveSessions(s); }
    refreshAdmin();
  };

  if (!authState.ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0b0c10", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Loading...</div>
          <div style={{ fontSize: 14, color: "#43B3AE" }}>VCH Systems</div>
        </div>
      </div>
    );
  }

  const isAdmin = authState.role === "admin";

return (
    <div className="app-container">
      <Sidebar />

      <main className="main-content" style={{ maxWidth: "none", paddingLeft: "40px", paddingRight: "40px" }}>
        <div className="fade-in">
          {/* Logo & Title Section */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
            <div style={{
              width: 160, height: 48,
              background: "linear-gradient(135deg, #fff 0%, #ccc 100%)",
              borderRadius: 10, display: "flex", alignItems: "center",
              justifyContent: "center",
            }}>
              <span style={{ fontWeight: 900, fontSize: 22, color: "#111", letterSpacing: 1 }}>RAPTEE</span>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "rgba(160,160,171,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                Thermal Suite
              </div>
              <div style={{ fontSize: 14, color: "#43B3AE", fontWeight: 600 }}>
                Analytics Engine V4
              </div>
            </div>
          </div>

          {/* User Info */}
          <div style={{ color: "rgba(160,160,171,0.6)", fontSize: 13, marginBottom: 24 }}>
            Logged in as: <span style={{ color: "#43B3AE", fontWeight: 700 }}>{authState.username}</span>
            {isAdmin && (
              <span style={{ marginLeft: 12, fontSize: 10, fontWeight: 800, textTransform: "uppercase", background: "rgba(67,179,174,0.12)", border: "1px solid rgba(67,179,174,0.28)", color: "#43B3AE", padding: "3px 8px", borderRadius: 6, letterSpacing: 1 }}>
                Admin
              </span>
            )}
          </div>

          <hr className="soft-divider" />

{/* Section Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, marginTop: 32 }}>
            <Rocket size={22} color="#ff8a5b" />
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>Active Testing Environments</h2>
          </div>

          {/* Nav Cards - Side by Side */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, marginBottom: 80 }}>
            {/* Dyno Suite Card */}
            <div className="nav-card" style={{ "--card-accent-border": "rgba(67,179,174,0.28)" }}>
              <div style={{ position: "absolute", top: 20, right: 24 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, padding: "5px 10px", borderRadius: 8, background: "rgba(67,179,174,0.15)", border: "1px solid rgba(67,179,174,0.4)", color: "#43B3AE" }}>
                  QC Gatekeeper
                </span>
              </div>

              <div style={{ fontSize: 44, marginBottom: 16 }}>⚙️</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 14, color: "#fff" }}>Dyno Suite</div>
              <div style={{ color: "rgba(160,160,171,0.8)", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                Strict Quality Control engine that evaluates stationary <strong style={{ color: "#fff" }}>Dewesoft Telemetry</strong> against mathematically calculated <strong style={{ color: "#fff" }}>Golden Standards</strong>.
              </div>

              <ul style={{ color: "rgba(160,160,171,0.7)", fontSize: 14, marginTop: 16, marginBottom: 24, listStyle: "none", padding: 0 }}>
                <li style={{ marginBottom: 10, paddingLeft: 16, borderLeft: "2px solid #333" }}>
                  <strong style={{ color: "#ccc" }}>Statistical Envelopes:</strong> Automated ±2-Sigma Boundaries.
                </li>
                <li style={{ marginBottom: 10, paddingLeft: 16, borderLeft: "2px solid #333" }}>
                  <strong style={{ color: "#ccc" }}>QC Gatekeeper:</strong> Dynamic Power & Early Deration tracking.
                </li>
                <li style={{ marginBottom: 10, paddingLeft: 16, borderLeft: "2px solid #333" }}>
                  <strong style={{ color: "#ccc" }}>Automated Docs:</strong> 1-Click Executive Word Report Generator.
                </li>
              </ul>

              <Link href="/dyno" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 24px", borderRadius: 12, background: "rgba(67,179,174,0.12)", border: "1px solid rgba(67,179,174,0.3)", color: "#43B3AE", fontWeight: 800, fontSize: 14, textDecoration: "none", transition: "all 0.25s" }}>
                <Activity size={18} /> Launch Dyno Engine
              </Link>
            </div>

            {/* Road Suite Card */}
            <div className="nav-card" style={{ "--card-accent-border": "rgba(171,99,250,0.24)" }}>
              <div style={{ position: "absolute", top: 20, right: 24 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, padding: "5px 10px", borderRadius: 8, background: "rgba(171,99,250,0.15)", border: "1px solid rgba(171,99,250,0.4)", color: "#ab63fa" }}>
                  ML Enabled
                </span>
              </div>

              <div style={{ fontSize: 44, marginBottom: 16 }}>🛣️</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 14, color: "#fff" }}>Road Suite</div>
              <div style={{ color: "rgba(160,160,171,0.8)", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                Dynamic telemetry processing engine. Ingests raw <strong style={{ color: "#fff" }}>CAN bus logs</strong> to visualize real-world powertrain performance and battery efficiency maps.
              </div>

              <ul style={{ color: "rgba(160,160,171,0.7)", fontSize: 14, marginTop: 16, marginBottom: 24, listStyle: "none", padding: 0 }}>
                <li style={{ marginBottom: 10, paddingLeft: 16, borderLeft: "2px solid #333" }}>
                  <strong style={{ color: "#ccc" }}>Universal Decoder:</strong> Raw CAN & Excel to 2Hz Time-Series.
                </li>
                <li style={{ marginBottom: 10, paddingLeft: 16, borderLeft: "2px solid #333" }}>
                  <strong style={{ color: "#ccc" }}>Battery Analytics:</strong> SOC Drain & Bracketed Wh/km tracking.
                </li>
                <li style={{ marginBottom: 10, paddingLeft: 16, borderLeft: "2px solid #333" }}>
                  <strong style={{ color: "#ccc" }}>Thermal Protection:</strong> Motor Torque vs. Deration Overlay maps.
                </li>
              </ul>

              <Link href="/road" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 24px", borderRadius: 12, background: "rgba(171,99,250,0.12)", border: "1px solid rgba(171,99,250,0.3)", color: "#ab63fa", fontWeight: 800, fontSize: 14, textDecoration: "none", transition: "all 0.25s" }}>
                <Activity size={18} /> Launch Road Engine
              </Link>
            </div>

          </div>

          {/* Admin Zone - Expandable */}
          {isAdmin && (
            <div style={{ marginBottom: 40 }}>
              <button
                onClick={() => { setAdminExpanded(!adminExpanded); refreshAdmin(); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 24px", background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)",
                  borderRadius: 14, cursor: "pointer", color: "#FFD700", fontSize: 16, fontWeight: 800,
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <ShieldCheck size={20} />
                  🛡️ ADMINISTRATION ZONE
                </div>
                <span style={{ fontSize: 20, transition: "transform 0.2s", transform: adminExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
              </button>

              {adminExpanded && (
                <div style={{ marginTop: 20, background: "rgba(16,18,24,0.6)", border: "1px solid rgba(255,215,0,0.15)", borderTop: "none", borderRadius: "0 0 14px 14px", padding: "24px 28px" }}>
                  {/* Tabs */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                    <button className={`admin-tab ${adminTab === "users" ? "active" : ""}`} onClick={() => { setAdminTab("users"); refreshAdmin(); setUserMsg(null); }}>
                      <UsersIcon size={14} /> User Management
                    </button>
                    <button className={`admin-tab ${adminTab === "sessions" ? "active" : ""}`} onClick={() => { setAdminTab("sessions"); refreshAdmin(); setUserMsg(null); }}>
                      <Monitor size={14} /> Active Sessions
                    </button>
                  </div>

                  {adminTab === "users" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>System Users</div>
                        {Object.entries(users).map(([uname, udata]) => (
                          <div key={uname} className="user-row">
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{uname}</div>
                              <div style={{ fontSize: 11, color: "#43B3AE", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{udata.role}</div>
                            </div>
                            {uname !== "admin" && (
                              <button className="act-btn" onClick={() => deleteUser(uname)} style={{ borderColor: "rgba(255,75,75,0.35)", color: "#FF6B6B", background: "rgba(255,75,75,0.06)", padding: "8px 16px" }}>
                                <Trash2 size={12} style={{ display: "inline", marginRight: 4 }} /> Delete
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Add New User</div>
                        {userMsg && <div className={userMsg.type === "ok" ? "msg-ok" : "msg-err"}>{userMsg.text}</div>}
                        <div style={{ display: "grid", gap: 12 }}>
                          <input className="form-inp" placeholder="New username" value={newU} onChange={(e) => setNewU(e.target.value)} />
                          <input className="form-inp" type="password" placeholder="Password" value={newP} onChange={(e) => setNewP(e.target.value)} />
                          <select className="role-sel" value={newR} onChange={(e) => setNewR(e.target.value)} style={{ padding: "11px 14px" }}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button className="act-btn" onClick={createUser} style={{ borderColor: "rgba(67,179,174,0.35)", color: "#43B3AE", background: "rgba(67,179,174,0.08)", padding: "12px 18px", fontSize: 13 }}>
                            <Plus size={14} style={{ display: "inline", marginRight: 6 }} /> Create User
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {adminTab === "sessions" && (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>
                        Monitor and terminate active user connections across the VCH Dashboard.
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 180px 140px", padding: "10px 16px", gap: 16, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "rgba(160,160,171,0.5)", marginBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span>Visitor</span><span>Session ID</span><span>Connection Time</span><span>Action</span>
                      </div>

                      {Object.entries(sessions).filter(([, data]) => data.status === "active").length === 0 ? (
                        <div style={{ color: "rgba(160,160,171,0.5)", fontSize: 14, padding: "20px 0" }}>
                          No active sessions currently found.
                        </div>
                      ) : (
                        Object.entries(sessions).map(([sid, data]) => data.status === "active" && (
                          <div key={sid} className="session-row">
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 16 }}>🧑‍💻</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{data.username}</span>
                            </div>
                            <code style={{ fontSize: 12, color: "rgba(160,160,171,0.6)", background: "rgba(255,255,255,0.04)", padding: "4px 10px", borderRadius: 6, fontFamily: "monospace" }}>
                              {sid.slice(0, 20)}...
                            </code>
                            <div style={{ fontSize: 13, color: "rgba(160,160,171,0.6)" }}>{data.login_time}</div>
                            {data.status === "active" && (
                              <button className="act-btn" onClick={() => terminateSession(sid)} style={{ borderColor: "rgba(255,75,75,0.35)", color: "#FF6B6B", background: "rgba(255,75,75,0.06)", padding: "8px 14px" }}>
                                <X size={11} style={{ display: "inline", marginRight: 4 }} /> Terminate
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 40, paddingTop: 24, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
            Raptee.HV Engineering Systems · Developed for VCH Analysis
          </div>
        </div>
      </main>
    </div>
  );
}


