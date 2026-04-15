"use client";
import React, { useState } from "react";
import { Zap, ChevronDown, ChevronUp, RefreshCw, PanelLeftClose, PanelLeftOpen, Home, Activity, Thermometer, Zap as ZapIcon, TrendingUp, Battery, Cpu, AlertTriangle, ClipboardList, Route } from "lucide-react";
import { useRouter } from "next/navigation";

const CHANNEL_TABS = [
  { id: "thermal", label: "Thermal Systems", icon: <Thermometer size={14} />, color: "#FF4B4B" },
  { id: "dynamic", label: "Dynamic Systems", icon: <ZapIcon size={14} />, color: "#00CC96" },
  { id: "analytics", label: "Ride Analytics", icon: <TrendingUp size={14} />, color: "#8388B9" },
  { id: "battery", label: "Battery & Range", icon: <Battery size={14} />, color: "#CFFF60" },
  { id: "driver", label: "Driver Diagnostics", icon: <Cpu size={14} />, color: "#FF6080" },
  { id: "events", label: "Ride Events & QC", icon: <AlertTriangle size={14} />, color: "#FFA15A" },
  { id: "repository", label: "Master Repository", icon: <ClipboardList size={14} />, color: "#EF553B" },
];

export default function RoadSidebar({
  rides = [],
  selectedRide,
  setSelectedRide,
  activeChannel,
  setActiveChannel,
  onRefresh,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const router = useRouter();

  const selectStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    background: "rgba(30,30,35,0.8)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 600,
    outline: "none", cursor: "pointer",
  };

  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: "#B4B4C0", marginBottom: 5, display: "block",
  };

  const dividerStyle = {
    borderTop: "1px solid rgba(255,255,255,0.08)", margin: "14px 0",
  };

  return (
    <aside
      style={{
        width: collapsed ? 72 : 320,
        minWidth: collapsed ? 72 : 320,
        maxWidth: collapsed ? 72 : 320,
        flexShrink: 0,
        transition: "width 0.28s ease, min-width 0.28s ease, max-width 0.28s ease",
        position: "relative",
        overflowX: "hidden",
        background: "linear-gradient(180deg, rgba(18,20,27,0.98), rgba(12,14,19,0.98))",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed((value) => !value)}
        style={{
          position: "absolute",
          top: 14,
          right: 12,
          width: 34,
          height: 34,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          color: "#d7dbe5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: collapsed ? 10 : 20, paddingRight: collapsed ? 0 : 40, paddingTop: 10 }}>
        <Zap size={18} style={{ color: "#00CC96" }} />
        {!collapsed && (
          <span style={{ color: "#00CC96", fontSize: 14, fontWeight: 900, letterSpacing: 2 }}>
            VCH SYSTEMS
          </span>
        )}
      </div>

      {/* Title */}
      {!collapsed && (
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 16 }}>
          Road VCH Suite
        </div>
      )}

      {/* Navigation Links */}
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

      {/* Divider */}
      {!collapsed && <div style={dividerStyle} />}

      {/* Mission Control Section */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <button
            onClick={() => { setConfigOpen(!configOpen); }}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: configOpen ? 0 : 10,
            }}
          >
            <span>Diagnostic Config</span>
            {configOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      )}

      {!collapsed && configOpen && (
        <div style={{ padding: "12px", borderRadius: "0 0 8px 8px", marginBottom: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none", flex: 1, overflowY: "auto" }}>
          {/* Ride Selector */}
          <span style={labelStyle}>Select Ride</span>
          <select
            value={selectedRide}
            onChange={(e) => setSelectedRide(e.target.value)}
            style={{ ...selectStyle, marginBottom: 12 }}
          >
            <option value="">-- Select Ride --</option>
            {rides.map((r) => (
              <option key={r.Ride_Name} value={r.Ride_Name}>{r.Ride_Name}</option>
            ))}
          </select>

          {/* Channel Tabs */}
          <span style={labelStyle}>Channel Selection</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {CHANNEL_TABS.map((tab) => {
              const isActive = activeChannel === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveChannel(tab.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderRadius: 8, background: isActive ? `${tab.color}15` : "transparent",
                    border: isActive ? `1px solid ${tab.color}44` : "1px solid transparent",
                    color: isActive ? tab.color : "#B4B4C0", fontSize: 12, fontWeight: isActive ? 700 : 600,
                    cursor: "pointer", transition: "all 0.2s ease", width: "100%", textAlign: "left",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; } }}
                >
                  <span style={{ color: isActive ? tab.color : "#666" }}>{Icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={onRefresh}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                background: "rgba(0,204,150,0.15)", border: "1px solid rgba(0,204,150,0.3)",
                color: "#00CC96", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <RefreshCw size={13} /> Refresh Data
            </button>
          </div>
        </div>
      )}

      {/* Collapsed View */}
      {collapsed && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 10 }}>
          {[
            { icon: Home, action: () => router.push("/") },
            { icon: Activity, action: () => router.push("/dyno") },
            { icon: RefreshCw, action: onRefresh },
            { icon: Route, action: () => {} },
          ].map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              style={{
                width: 44, height: 44, borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#d5dae4", display: "flex",
                alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <item.icon size={18} />
            </button>
          ))}
        </div>
      )}

      {/* Footer spacer */}
      <div style={{ height: 20 }} />
    </aside>
  );
}
