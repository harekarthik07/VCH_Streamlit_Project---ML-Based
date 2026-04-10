"use client";
import React from "react";
import Sidebar from "../components/Sidebar";
import Link from "next/link";
import { Route } from "lucide-react";

export default function RoadPage() {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="fade-in" style={{ maxWidth: 1380 }}>
          <div style={{ marginBottom: 28 }}>
            <h1 className="section-title" style={{ marginBottom: 10 }}>Road Suite</h1>
            <p className="section-subtitle">
              Dedicated page scaffold for the future road telemetry engine. The analytics logic will come next, but the page shell and navigation are ready now.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, marginBottom: 22 }}>
            <div className="metric-card" style={{ padding: "34px 30px" }}>
              <div style={{ marginBottom: 18 }}>
                <Route size={40} style={{ color: "#c8cfdd" }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 14 }}>Road Telemetry Engine</div>
              <div style={{ color: "var(--text-sub)", fontSize: 15, lineHeight: 1.7, marginBottom: 18 }}>
                This page will host the streamlit-style road suite with decoded CAN traces, efficiency maps, thermal protection overlays, and route-level diagnostics.
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  "Dedicated route for road analytics",
                  "Shared master-app navigation shell",
                  "Minimal placeholder until road logic is implemented",
                ].map((item) => (
                  <div key={item} style={{ color: "var(--text-sub)", fontSize: 14, borderLeft: "2px solid rgba(255,255,255,0.12)", paddingLeft: 12 }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="metric-card"
              style={{
                padding: "34px 30px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div className="metric-title">Status</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Page Ready</div>
                <div style={{ color: "var(--text-sub)", fontSize: 14, lineHeight: 1.7 }}>
                  The standalone road page exists now so we can wire the road suite into the master app cleanly in the next pass.
                </div>
              </div>
              <Link className="pill-button" href="/">
                Back To Master App
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
