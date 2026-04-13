"use client";
import React, { useState, useMemo } from "react";
import { Zap, FolderOpen, Settings, ChevronDown, ChevronUp, RefreshCw, PanelLeftClose, PanelLeftOpen, Home, Activity, Thermometer, Gauge, Battery, Cpu, ShieldAlert, Database } from "lucide-react";
import { useRouter } from "next/navigation";

export default function RoadSidebar({
  summaries = [],
  selectedTest,
  setSelectedTest,
  compareTests = [],
  setCompareTests,
  channelDomain,
  setChannelDomain,
  activeChannels = [],
  setActiveChannels,
  onRefresh,
  appMode,
  setAppMode,
}) {
  const [missionOpen, setMissionOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  // Shared styles
  const selectStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    background: "rgba(30,30,35,0.8)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 600,
    outline: "none", cursor: "pointer",
  };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: "#B4B4C0", marginBottom: 5, display: "block" };
  const sectionTitleStyle = { fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 10, marginTop: 4 };
  const dividerStyle = { borderTop: "1px solid rgba(255,255,255,0.08)", margin: "14px 0" };

  const DOMAIN_OPTIONS = [
    { name: "Thermal Systems", icon: Thermometer },
    { name: "Dynamic Systems", icon: Zap },
    { name: "Ride Analytics", icon: Gauge },
    { name: "Battery & Range", icon: Battery },
    { name: "Driver Diagnostics", icon: Cpu },
    { name: "Ride Events & QC", icon: ShieldAlert },
    { name: "Master Repository", icon: Database }
  ];

  const THERMAL_OPTS = ["IGBT", "Motor", "HighCell", "AFE"];
  const DYNAMIC_OPTS = ["RPM [RPM]", "Front_Speed [kph]", "Throttle", "soc", "Instant_Power [W]", "DC_Volatge [V]", "Motor_Torque [Nm]"];

  return (
    <aside
      className="road-sidebar"
      style={{
        width: collapsed ? 72 : 320,
        minWidth: collapsed ? 72 : 320,
        maxWidth: collapsed ? 72 : 320,
        flexShrink: 0,
        minHeight: "100vh",
        transition: "width 0.28s ease, min-width 0.28s ease, max-width 0.28s ease",
        position: "relative",
        overflowX: "hidden",
        background: "linear-gradient(180deg, rgba(18,20,27,0.98), rgba(12,14,19,0.98))",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        padding: collapsed ? "20px 0" : "20px"
      }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: "absolute", top: 14, right: 12, width: 34, height: 34, borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
          color: "#d7dbe5", display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 2
        }}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: collapsed ? 10 : 20, paddingLeft: collapsed ? 25 : 0 }}>
        <Zap size={18} style={{ color: "#00CC96" }} />
        {!collapsed && <span style={{ color: "#00CC96", fontSize: 14, fontWeight: 900, letterSpacing: 2 }}>VCH SYSTEMS</span>}
      </div>

      {!collapsed && <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 16 }}>Road VCH Suite</div>}

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: 16 }}>
          <button
            onClick={() => router.push("/")}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#B4B4C0", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#FFF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#B4B4C0"; }}
          >
            <Home size={15} /> Main Dashboard
          </button>
          <button
            onClick={() => router.push("/dyno")}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#B4B4C0", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#FFF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#B4B4C0"; }}
          >
            <Activity size={15} /> Dyno Suite
          </button>
        </div>
      )}

      {!collapsed && (
        <div style={{ marginBottom: 6 }}>
          <span style={labelStyle}>Navigation</span>
          {["Monitor Dashboard", "Data Engine"].map((mode) => (
            <label
              key={mode}
              onClick={() => setAppMode(mode)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                cursor: "pointer", fontSize: 13, fontWeight: 600,
                color: appMode === mode ? "#00CC96" : "#B4B4C0",
              }}
            >
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                border: `2px solid ${appMode === mode ? "#00CC96" : "#555"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {appMode === mode && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00CC96" }} />}
              </span>
              {mode}
            </label>
          ))}
        </div>
      )}

      {!collapsed && <div style={dividerStyle} />}

      {!collapsed && (
        <button
          onClick={onRefresh}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 8,
            background: "rgba(0,204,150,0.15)", border: "1px solid rgba(0,204,150,0.3)",
            color: "#00CC96", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            marginBottom: 14, transition: "all 0.2s ease",
          }}
        >
          <RefreshCw size={13} /> Refresh Data
        </button>
      )}

      {!collapsed && (
        <button
          onClick={() => setMissionOpen(!missionOpen)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: missionOpen ? 0 : 10,
          }}
        >
          <span><FolderOpen size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Mission Control</span>
          {missionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

      {!collapsed && missionOpen && (
        <div style={{ padding: "12px", borderRadius: "0 0 8px 8px", marginBottom: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none" }}>
          <span style={labelStyle}>Primary Test Log</span>
          <select value={selectedTest} onChange={(e) => setSelectedTest(e.target.value)} style={{ ...selectStyle, marginBottom: 10 }}>
            <option value="RouteA_Bike001">RouteA_Bike001 (Mock)</option>
            {summaries.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {!collapsed && (
        <button
          onClick={() => setConfigOpen(!configOpen)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: configOpen ? 0 : 10,
          }}
        >
          <span><Settings size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Diagnostic Config</span>
          {configOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

      {!collapsed && configOpen && (
        <div style={{ padding: "12px", borderRadius: "0 0 8px 8px", marginBottom: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none" }}>
          <span style={labelStyle}>Domain Selection</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 15 }}>
            {DOMAIN_OPTIONS.map((domain) => {
              const isActive = channelDomain === domain.name;
              const Icon = domain.icon;
              return (
                <button
                  key={domain.name}
                  onClick={() => setChannelDomain(domain.name)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                    borderRadius: 8, background: isActive ? "rgba(0,204,150,0.15)" : "transparent",
                    border: isActive ? "1px solid rgba(0,204,150,0.3)" : "1px solid transparent",
                    color: isActive ? "#00CC96" : "#B4B4C0", fontSize: 12, fontWeight: isActive ? 700 : 600,
                    cursor: "pointer", transition: "all 0.2s ease", textAlign: "left", width: "100%"
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon size={14} />
                  {domain.name}
                </button>
              );
            })}
          </div>

          {(channelDomain === "Thermal Systems" || channelDomain === "Dynamic Systems") && (
            <>
              <span style={labelStyle}>Sub-Channels</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(channelDomain === "Thermal Systems" ? THERMAL_OPTS : DYNAMIC_OPTS).map(ch => {
                  const isOn = activeChannels.includes(ch);
                  return (
                    <span
                      key={ch}
                      onClick={() => setActiveChannels(isOn ? activeChannels.filter(c => c !== ch) : [...activeChannels, ch])}
                      style={{
                        padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: `1px solid ${isOn ? "#00CC96" : "rgba(255,255,255,0.1)"}`,
                        background: isOn ? "rgba(0,204,150,0.1)" : "transparent",
                        color: isOn ? "#00CC96" : "#888", cursor: "pointer"
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {collapsed && (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {[Home, Activity, RefreshCw, FolderOpen, Settings].map((Icon, index) => (
            <button
              key={index}
              onClick={() => {
                if (index === 0) router.push("/");
                if (index === 1) router.push("/dyno");
                if (index === 2) { onRefresh && onRefresh(); setCollapsed(false); }
                if (index === 3) { setMissionOpen(true); setCollapsed(false); }
                if (index === 4) { setConfigOpen(true); setCollapsed(false); }
              }}
              style={{
                width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)", color: "#d5dae4", display: "flex",
                alignItems: "center", justifyContent: "center", cursor: "pointer"
              }}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}