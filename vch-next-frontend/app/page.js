"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import { Rocket, Settings, Route } from "lucide-react";

export default function DashboardHome() {
  const router = useRouter();
  const [authState] = useState(() => {
    if (typeof window === "undefined") return { username: "", ready: false };
    const stored = window.localStorage.getItem("vch-auth");
    if (!stored) return { username: "", ready: false };
    try {
      const parsed = JSON.parse(stored);
      return { username: parsed?.username || "admin", ready: true };
    } catch {
      window.localStorage.removeItem("vch-auth");
      return { username: "", ready: false };
    }
  });

  useEffect(() => {
    if (!authState.ready) {
      router.replace("/login");
    }
  }, [authState.ready, router]);

  if (!authState.ready) return null;

  const cards = [
    {
      title: "Dyno Suite",
      icon: <Settings size={42} style={{ color: "#d7d1e8" }} />,
      href: "/dyno",
      cta: "Launch Dyno Engine",
      description:
        "Strict Quality Control gatekeeper designed to evaluate stationary Dewesoft telemetry against calculated Golden Standards.",
      features: [
        "Statistical Envelopes: Automated +-2-Sigma boundaries.",
        "QC Gatekeeper: Dynamic power and early deration tracking.",
        "Automated Docs: Executive report workflow.",
      ],
    },
    {
      title: "Road Suite",
      icon: <Route size={42} style={{ color: "#d7d1e8" }} />,
      href: "/road",
      cta: "Launch Road Engine",
      description:
        "Dynamic telemetry processing space for raw CAN logs, efficiency analysis, and real-world powertrain behavior.",
      features: [
        "Universal Decoder: Raw CAN and Excel to 2Hz time-series.",
        "Battery Analytics: SOC drain and Wh/km workflows.",
        "Thermal Protection: Torque versus deration overlays.",
      ],
    },
  ];

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="fade-in" style={{ maxWidth: 1480 }}>
          <div style={{ marginBottom: 22 }}>
            <div
              style={{
                width: 182,
                height: 74,
                borderRadius: 10,
                background: "#f2f2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#151515",
                fontSize: 28,
                fontWeight: 800,
                marginBottom: 26,
              }}
            >
              RAPTEE
            </div>
            <h1 className="section-title" style={{ fontSize: 58, marginBottom: 12 }}>
              Raptee Thermal Suite
            </h1>
            <div style={{ color: "var(--primary-accent)", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              Thermal & Dynamics Analytics Engine V4
            </div>
            <div className="section-subtitle">
              Logged in as: <span style={{ color: "var(--primary-accent)", fontWeight: 700 }}>{authState.username}</span>
            </div>
          </div>

          <hr className="soft-divider" />

          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <Rocket size={26} color="#ff8a5b" />
              <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>Active Testing Environments</h2>
            </div>
            <p className="section-subtitle">
              Select a module below or use the sidebar to launch the dedicated evaluation suites.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 }}>
            {cards.map((card) => (
              <div key={card.href} className="metric-card" style={{ padding: "34px 28px 26px" }}>
                <div style={{ marginBottom: 22 }}>{card.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{card.title}</div>
                <div style={{ color: "var(--text-sub)", fontSize: 15, lineHeight: 1.7, marginBottom: 18 }}>
                  {card.description}
                </div>
                <div style={{ display: "grid", gap: 10, marginBottom: 22 }}>
                  {card.features.map((feature) => (
                    <div
                      key={feature}
                      style={{
                        color: "var(--text-sub)",
                        fontSize: 14,
                        borderLeft: "2px solid rgba(255,255,255,0.12)",
                        paddingLeft: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {feature}
                    </div>
                  ))}
                </div>
                <Link className="pill-button" href={card.href} style={{ width: "fit-content" }}>
                  {card.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
