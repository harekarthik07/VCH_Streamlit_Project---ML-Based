"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import { Battery, Cpu, HardDrive, Search } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8001";

export default function FleetPage() {
  const [bikes, setBikes] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/api/fleet`)
      .then((r) => { setBikes(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const bikeEntries = Object.entries(bikes).filter(([id]) =>
    id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="fade-in">
          <h1 style={{ fontWeight: 900, fontSize: 38, letterSpacing: "-1px", margin: 0 }}>
            Fleet Hardware Registry
          </h1>
          <p style={{ color: "var(--text-sub)", fontSize: 15, marginTop: 8, marginBottom: 24 }}>
            Live inventory of all registered bikes, their hardware modules, and current status.
          </p>
        </div>

        {/* Search Bar */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "var(--card-bg)", backdropFilter: "blur(12px)",
            border: "1px solid var(--card-border)", borderRadius: 12,
            padding: "10px 16px", marginBottom: 28, maxWidth: 400,
          }}
        >
          <Search size={16} style={{ color: "var(--text-title)", opacity: 0.6 }} />
          <input
            type="text"
            placeholder="Search bike ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "var(--text-main)", fontSize: 14, fontFamily: "inherit",
              width: "100%",
            }}
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ color: "var(--text-sub)", fontSize: 14, padding: 20 }}>
            Loading fleet data…
          </div>
        )}

        {/* Bike Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {bikeEntries.map(([bikeId, info]) => {
            const statusColor = info.status === "Active" ? "var(--primary-accent)" : info.status === "Offline" ? "var(--danger-accent)" : "#FFBE0B";
            return (
              <div key={bikeId} className="metric-card fade-in" style={{ position: "relative" }}>
                {/* Status dot */}
                <div style={{
                  position: "absolute", top: 16, right: 16,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: statusColor, boxShadow: `0 0 6px ${statusColor}`,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, textTransform: "uppercase", letterSpacing: 1 }}>
                    {info.status || "Unknown"}
                  </span>
                </div>

                {/* Bike ID & Tests */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10,
                    background: "rgba(67,179,174,0.12)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Cpu size={20} style={{ color: "var(--primary-accent)" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text-main)" }}>{bikeId}</div>
                    <div style={{ fontSize: 12, color: "var(--text-title)" }}>
                      {info.tests_done ?? 0} tests completed
                    </div>
                  </div>
                </div>

                {/* Hardware Details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                  {[
                    { label: "VIN", value: info.vin },
                    { label: "Battery Box", value: info.battery_box_id },
                    { label: "Left Module", value: info.left_module_id },
                    { label: "Right Module", value: info.right_module_id },
                    { label: "BMS ID", value: info.bms_id },
                    { label: "Motor ID", value: info.motor_id },
                  ].map((row) => (
                    <div key={row.label}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-title)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>
                        {row.label}
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: row.value === "UNASSIGNED" ? "rgba(255,255,255,0.25)" : "var(--text-main)",
                        fontStyle: row.value === "UNASSIGNED" ? "italic" : "normal",
                      }}>
                        {row.value || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {!loading && bikeEntries.length === 0 && (
          <div style={{
            textAlign: "center", padding: 60, color: "var(--text-sub)", fontSize: 15,
          }}>
            No bikes found. Check that the CSV registry is loaded and FastAPI is running.
          </div>
        )}
      </main>
    </div>
  );
}

