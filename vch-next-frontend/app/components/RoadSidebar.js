"use client";
import React, { useState } from "react";
import {
  Zap, ChevronDown, ChevronUp, RefreshCw, PanelLeftClose, PanelLeftOpen,
  Home, Activity, Thermometer, Zap as ZapIcon, TrendingUp, Battery, Cpu,
  AlertTriangle, ClipboardList, Route, FolderOpen, ChevronRight, Download, UploadCloud
} from "lucide-react";
import { useRouter } from "next/navigation";
import StreamlitSelect from "./StreamlitSelect";
import StreamlitMultiSelect from "./StreamlitMultiSelect";

const CHANNEL_TABS = [
  { id: "thermal", label: "Thermal Systems", icon: <Thermometer size={16} />, color: "#FF4B4B" },
  { id: "dynamic", label: "Dynamic Systems", icon: <ZapIcon size={16} />, color: "#43B3AE" },
  { id: "analytics", label: "Ride Analytics", icon: <TrendingUp size={16} />, color: "#8388B9" },
  { id: "battery", label: "Battery & Range", icon: <Battery size={16} />, color: "#CFFF60" },
  { id: "driver", label: "Driver Diagnostics", icon: <Cpu size={16} />, color: "#FF6080" },
  { id: "events", label: "Ride Events & QC", icon: <AlertTriangle size={16} />, color: "#FFA15A" },
  { id: "repository", label: "Master Repository", icon: <FolderOpen size={16} />, color: "#EF553B" },
  { id: "data_engine", label: "Data Engine", icon: <UploadCloud size={16} />, color: "#55AAFF" },
];

export default function RoadSidebar({
  rides = [],
  selectedRide,
  setSelectedRide,
  activeChannel,
  setActiveChannel,
  comparisonRides = [],
  setComparisonRides,
  onRefresh,
  showTimeFilter,
  setShowTimeFilter,
  timeRange,
  setTimeRange,
  exportAllThermals,
  maxTime = 0,
  routeFilter = "All Routes",
  setRouteFilter,
  dateFilter = "All Dates",
  setDateFilter,
  uniqueRoutes = [],
  uniqueDates = []
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [missionOpen, setMissionOpen] = useState(true);
  const [diagOpen, setDiagOpen] = useState(true);
  const router = useRouter();

  const selectStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff", fontSize: 13, fontWeight: 600,
    outline: "none", cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    backgroundSize: "16px",
  };

  const sectionSubHeader = {
    fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 14,
    display: "flex", alignItems: "center", gap: 10
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 700, color: "#A0A0AB", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, opacity: 0.9
  };

  const accordionToggle = (title, icon, isOpen, setIsOpen) => (
    <button
      onClick={() => setIsOpen(!isOpen)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
        transition: "all 0.3s ease",
      }}
    >
      <ChevronRight size={16} style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.3s", color: "#43B3AE" }} />
      {icon}
      <span style={{ flex: 1, textAlign: "left" }}>{title}</span>
    </button>
  );

  return (
    <aside
      style={{
        width: collapsed ? 72 : 340,
        minWidth: collapsed ? 72 : 340,
        maxWidth: collapsed ? 72 : 340,
        flexShrink: 0,
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        background: "#201e24",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(24px)",
        zIndex: 100,
      }}
    >
      {/* Brand Header */}
      <div style={{ padding: "24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => router.push("/")}>
          <div style={{ 
            width: 48, height: 32, borderRadius: 6, 
            background: "#fff", 
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            padding: "2px"
          }}>
            <img 
              src="/raptee_logo.png" 
              alt="Raptee Logo" 
              style={{ width: "100%", height: "100%", objectFit: "contain" }} 
            />
          </div>
          {!collapsed && <span style={{ color: "#fff", fontWeight: 900, fontSize: 16, letterSpacing: -0.5 }}>VCH ROAD <span style={{ color: "#43B3AE" }}>SUITE</span></span>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "visible", padding: "20px 16px" }}>
        {!collapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: 24 }}>
            <button
              onClick={() => router.push("/")}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#B4B4C0", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#FFF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#B4B4C0"; }}
            >
              <Home size={16} /> Dyno VCH Suite
            </button>
            <button
              onClick={() => router.push("/data-engine")}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#B4B4C0", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#FFF"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#B4B4C0"; }}
            >
              <Activity size={16} /> Data Engine (Upload)
            </button>
          </div>
        )}

        {!collapsed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* Group 1: Mission Control */}
            <div>
              {accordionToggle("Mission Control & Navigation", <FolderOpen size={16} color="#FFD700" />, missionOpen, setMissionOpen)}
              {missionOpen && (
                <div style={{ padding: "20px 10px 10px", display: "flex", flexDirection: "column", gap: 20, borderLeft: "1px solid rgba(255,255,255,0.05)", marginLeft: 22 }}>
                  
                  {/* Data Browser */}
                  <div>
                    <div style={sectionSubHeader}>1. Data Browser</div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}><ClipboardList size={14} /> Filter Date:</label>
                      <StreamlitSelect 
                        value={dateFilter} 
                        onChange={setDateFilter} 
                        options={uniqueDates} 
                        placeholder="All Dates" 
                      />
                    </div>
                    <div>
                      <label style={labelStyle}><Route size={14} /> Filter Route:</label>
                      <StreamlitSelect 
                        value={routeFilter} 
                        onChange={setRouteFilter} 
                        options={uniqueRoutes} 
                        placeholder="All Routes" 
                      />
                    </div>
                  </div>

                  {/* Active Selection */}
                  <div>
                    <div style={sectionSubHeader}>2. Active Selection</div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}><Activity size={14} color="#FF6080" /> Primary Test Log:</label>
                      <StreamlitSelect
                        value={selectedRide}
                        onChange={(val) => setSelectedRide(val)}
                        options={rides.map(r => r.Ride_Name)}
                        placeholder="Select a ride"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}><Zap size={14} color="#CFFF60" /> Compare Tests:</label>
                      <StreamlitMultiSelect
                        value={comparisonRides}
                        onChange={setComparisonRides}
                        options={rides.map(r => r.Ride_Name).filter(name => name !== selectedRide)}
                        placeholder="Choose options"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Group 2: Diagnostic Config */}
            <div>
              {accordionToggle("Diagnostic Config", <Cpu size={16} color="#43B3AE" />, diagOpen, setDiagOpen)}
              {diagOpen && (
                <div style={{ padding: "12px 0 0", display: "flex", flexDirection: "column", gap: 6, borderLeft: "1px solid rgba(255,255,255,0.05)", marginLeft: 22 }}>
                  {CHANNEL_TABS.map((tab) => {
                    const isActive = activeChannel === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveChannel(tab.id)}
                        className={`sidebar-link ${isActive ? "active" : ""}`}
                        style={{
                          padding: "12px 16px",
                          borderRadius: 10,
                          margin: "2px 8px 2px 0",
                          background: isActive ? "#43B3AE" : "rgba(255,255,255,0.04)",
                          border: isActive ? "1px solid #43B3AE" : "1px solid rgba(255,255,255,0.03)",
                          color: isActive ? "#fff" : "#A0A0AB",
                          fontSize: 13,
                          fontWeight: isActive ? 800 : 600,
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          boxShadow: isActive ? "0 4px 12px rgba(67, 179, 174, 0.3)" : "none",
                        }}
                      >
                        <span style={{ opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
                        {tab.label}
                      </button>
                    );
                  })}

                  {/* Visual Controls */}
                  <div style={{ marginTop: 24, padding: "0 10px 10px" }}>
                    <div style={sectionSubHeader}>3. Visual Controls</div>
                    
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}><TrendingUp size={14} /> Time Window:</label>
                      <button
                        onClick={() => setShowTimeFilter(!showTimeFilter)}
                        style={{
                          width: "100%", padding: "10px", borderRadius: 10,
                          background: showTimeFilter ? "rgba(67,179,174,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${showTimeFilter ? "#43B3AE" : "rgba(255,255,255,0.1)"}`,
                          color: showTimeFilter ? "#43B3AE" : "#888",
                          fontSize: 12, fontWeight: 700, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                        }}
                      >
                         Time Window {showTimeFilter ? "ON" : "OFF"}
                      </button>
                    </div>

                    {showTimeFilter && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                        <div>
                          <label style={{ ...labelStyle, fontSize: 10 }}>Start (s)</label>
                          <input
                            type="number"
                            value={timeRange.start}
                            onChange={(e) => setTimeRange({ ...timeRange, start: Math.max(0, parseFloat(e.target.value) || 0) })}
                            style={selectStyle}
                          />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, fontSize: 10 }}>End (s)</label>
                          <input
                            type="number"
                            value={timeRange.end}
                            onChange={(e) => setTimeRange({ ...timeRange, end: Math.min(maxTime, parseFloat(e.target.value) || maxTime) })}
                            style={selectStyle}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={exportAllThermals}
                      style={{
                        width: "100%", padding: "12px", borderRadius: 10,
                        background: "rgba(67,179,174,0.15)", border: "1px solid rgba(67,179,174,0.3)",
                        color: "#43B3AE", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      <Download size={14} /> Export All Test Data
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Global Actions */}
            <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 20 }}>
              <button
                onClick={onRefresh}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                <RefreshCw size={14} /> Refresh Diagnostic Data
              </button>
            </div>
          </div>
        )}

        {collapsed && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            {CHANNEL_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveChannel(tab.id); setCollapsed(false); }}
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: activeChannel === tab.id ? `${tab.color}20` : "transparent",
                  color: activeChannel === tab.id ? tab.color : "#666",
                  border: "none", cursor: "pointer",
                }}
              >
                {tab.icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div style={{ padding: 16, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "none", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {collapsed ? <ChevronRight size={16} /> : <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Collapse Viewer</div>}
        </button>
      </div>
    </aside>
  );
}
