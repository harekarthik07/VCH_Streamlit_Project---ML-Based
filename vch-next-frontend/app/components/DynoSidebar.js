"use client";
import React, { useState, useMemo } from "react";
import { Zap, FolderOpen, Settings, ChevronDown, ChevronUp, RefreshCw, PanelLeftClose, PanelLeftOpen, Home, Route } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DynoSidebar({
  summaries = [],
  selectedTest,
  setSelectedTest,
  compareTests = [],
  setCompareTests,
  channels = [],
  setChannels,
  envelopeMode,
  setEnvelopeMode,
  tolerancePct,
  setTolerancePct,
  snapshotDuration,
  setSnapshotDuration,
  onRefresh,
  appMode,
  setAppMode,
}) {
  const [missionOpen, setMissionOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  // Derived filters
  const allTests = summaries.map((s) => s.Test_Name);

  const [selectedTimeframes, setSelectedTimeframes] = useState(["All Timeframes"]);
  const [selectedBikes, setSelectedBikes] = useState(["All Vehicles"]);

  const availableTimeframes = useMemo(
    () => [...new Set(allTests.map((t) => t.substring(0, 7)))].sort().reverse(),
    [allTests]
  );

  const timeFilteredTests = useMemo(() => {
    if (selectedTimeframes.includes("All Timeframes")) return allTests;
    return allTests.filter((t) => selectedTimeframes.includes(t.substring(0, 7)));
  }, [allTests, selectedTimeframes]);

  const getBikeNo = (name) => {
    const parts = name.split("-");
    return parts.length > 1 ? parts[1] : name;
  };

  const availableBikes = useMemo(
    () => [...new Set(timeFilteredTests.map(getBikeNo))].sort(),
    [timeFilteredTests]
  );

  const filteredTests = useMemo(() => {
    if (selectedBikes.includes("All Vehicles")) return timeFilteredTests;
    return timeFilteredTests.filter((t) => selectedBikes.includes(getBikeNo(t)));
  }, [timeFilteredTests, selectedBikes]);

  // Shared styles
  const selectStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    background: "rgba(30,30,35,0.8)", border: "1px solid rgba(255,255,255,0.1)",
    color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 600,
    outline: "none", cursor: "pointer",
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: "#B4B4C0", marginBottom: 5, display: "block",
  };
  const sectionTitleStyle = {
    fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 10, marginTop: 4,
  };
  const dividerStyle = {
    borderTop: "1px solid rgba(255,255,255,0.08)", margin: "14px 0",
  };

  const toggleChip = (value, list, setter, allLabel) => {
    if (value === allLabel) {
      setter([allLabel]);
    } else {
      let newList = list.filter((v) => v !== allLabel);
      if (newList.includes(value)) {
        newList = newList.filter((v) => v !== value);
      } else {
        newList.push(value);
      }
      if (newList.length === 0) newList = [allLabel];
      setter(newList);
    }
  };

  const chipStyle = (isActive) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
    border: `1px solid ${isActive ? "#43B3AE" : "rgba(255,255,255,0.1)"}`,
    background: isActive ? "rgba(67,179,174,0.2)" : "transparent",
    color: isActive ? "#43B3AE" : "#B4B4C0",
    cursor: "pointer", transition: "all 0.2s ease", margin: "2px",
  });

  const channelChipStyle = (ch, isActive) => {
    const colors = { IGBT: "#636EFA", Motor: "#EF553B", HighCell: "#43B3AE", AFE: "#FFA15A" };
    const c = colors[ch] || "#fff";
    return {
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      border: `1px solid ${isActive ? c : "rgba(255,255,255,0.1)"}`,
      background: isActive ? `${c}22` : "transparent",
      color: isActive ? c : "#666",
      cursor: "pointer", transition: "all 0.2s ease", margin: "2px",
    };
  };

  return (
    <aside
      className="dyno-sidebar"
      style={{
        width: collapsed ? 72 : 320,
        minWidth: collapsed ? 72 : 320,
        maxWidth: collapsed ? 72 : 320,
        flexShrink: 0,
        transition: "width 0.28s ease, min-width 0.28s ease, max-width 0.28s ease",
        position: "relative",
        overflowX: "hidden",
        background: "linear-gradient(180deg, rgba(18,20,27,0.98), rgba(12,14,19,0.98))",
        borderRight: "1px solid rgba(255,255,255,0.06)"
      }}
    >
      <button
        onClick={() => setCollapsed((value) => !value)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
          zIndex: 2
        }}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: collapsed ? 10 : 20, paddingRight: 40 }}>
        <Zap size={18} style={{ color: "#43B3AE" }} />
        {!collapsed && (
          <span style={{ color: "#43B3AE", fontSize: 14, fontWeight: 900, letterSpacing: 2 }}>
            VCH SYSTEMS
          </span>
        )}
      </div>

      {/* Title */}
      {!collapsed && (
        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 16 }}>
          Dyno VCH Suite
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
            onClick={() => router.push("/road")}
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
            <Route size={15} /> Road Suite
          </button>
        </div>
      )}

      {!collapsed && <div style={dividerStyle} />}

      {/* Refresh Button */}
      {!collapsed && <button
        onClick={onRefresh}
        style={{
          width: "100%", padding: "8px 12px", borderRadius: 8,
          background: "rgba(67,179,174,0.15)", border: "1px solid rgba(67,179,174,0.3)",
          color: "#43B3AE", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          marginBottom: 14, transition: "all 0.2s ease",
        }}
      >
        <RefreshCw size={13} /> Refresh Data
      </button>}

      {/* ============ MISSION CONTROL EXPANDER ============ */}
      {!collapsed && <button
        onClick={() => setMissionOpen(!missionOpen)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
          cursor: "pointer", marginBottom: missionOpen ? 0 : 10,
        }}
      >
        <span><FolderOpen size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Mission Control & Navigation</span>
        {missionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>}

      {!collapsed && missionOpen && (
        <div style={{
          padding: "12px", borderRadius: "0 0 8px 8px", marginBottom: 10,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "none",
        }}>
          <div style={sectionTitleStyle}>1. Data Browser</div>

          <span style={labelStyle}>Timeframe (YYYY-MM)</span>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 12 }}>
            <span
              style={chipStyle(selectedTimeframes.includes("All Timeframes"))}
              onClick={() => toggleChip("All Timeframes", selectedTimeframes, setSelectedTimeframes, "All Timeframes")}
            >All Timeframes {selectedTimeframes.includes("All Timeframes") && "×"}</span>
            {availableTimeframes.map((tf) => (
              <span key={tf} style={chipStyle(selectedTimeframes.includes(tf))}
                onClick={() => toggleChip(tf, selectedTimeframes, setSelectedTimeframes, "All Timeframes")}
              >{tf} {selectedTimeframes.includes(tf) && "×"}</span>
            ))}
          </div>

          <span style={labelStyle}>Vehicle ID</span>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
            <span
              style={chipStyle(selectedBikes.includes("All Vehicles"))}
              onClick={() => toggleChip("All Vehicles", selectedBikes, setSelectedBikes, "All Vehicles")}
            >All Vehicles {selectedBikes.includes("All Vehicles") && "×"}</span>
            {availableBikes.map((bk) => (
              <span key={bk} style={chipStyle(selectedBikes.includes(bk))}
                onClick={() => toggleChip(bk, selectedBikes, setSelectedBikes, "All Vehicles")}
              >{bk} {selectedBikes.includes(bk) && "×"}</span>
            ))}
          </div>

          <div style={dividerStyle} />
          <div style={sectionTitleStyle}>2. Active Selection</div>

          <span style={labelStyle}>Primary Test Overlay</span>
          <select
            value={selectedTest}
            onChange={(e) => setSelectedTest(e.target.value)}
            style={{ ...selectStyle, marginBottom: 10 }}
          >
            {filteredTests.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <span style={labelStyle}>Comparison Overlays</span>
          <select
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val === "none") {
                setCompareTests([]);
              } else if (val) {
                if (!compareTests.includes(val)) {
                  setCompareTests([...compareTests, val]);
                }
              }
            }}
            style={{ ...selectStyle, marginBottom: 5 }}
          >
            <option value="" disabled>Choose options...</option>
            <option value="none">-- Clear All --</option>
            {filteredTests.filter((t) => t !== selectedTest && !compareTests.includes(t)).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {compareTests.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {compareTests.map(t => (
                <span key={t} onClick={() => setCompareTests(compareTests.filter(c => c !== t))} 
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)",
                    color: "#fff", cursor: "pointer", transition: "all 0.2s ease"
                  }}>
                  {t} <span style={{opacity: 0.5}}>×</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ DIAGNOSTIC CONFIG EXPANDER ============ */}
      {!collapsed && <button
        onClick={() => setConfigOpen(!configOpen)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
          cursor: "pointer", marginBottom: configOpen ? 0 : 10,
        }}
      >
        <span><Settings size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Diagnostic & Hardware Config</span>
        {configOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>}

      {!collapsed && configOpen && (
        <div style={{
          padding: "12px", borderRadius: "0 0 8px 8px", marginBottom: 10,
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "none",
        }}>
          <div style={sectionTitleStyle}>1. Channels</div>
          <span style={labelStyle}>Telemetry Channels</span>
          <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
            {["IGBT", "Motor", "HighCell", "AFE"].map((ch) => {
              const isOn = channels.includes(ch);
              return (
                <span
                  key={ch}
                  style={channelChipStyle(ch, isOn)}
                  onClick={() =>
                    setChannels(isOn ? channels.filter((c) => c !== ch) : [...channels, ch])
                  }
                >
                  {ch} {isOn && "×"}
                </span>
              );
            })}
          </div>

          <div style={dividerStyle} />
          <div style={sectionTitleStyle}>2. Advanced Settings</div>

          <span style={labelStyle}>Method:</span>
          {["Statistical (2-Sigma)", "Tolerance (%)"].map((mode) => (
            <label
              key={mode}
              onClick={() => setEnvelopeMode(mode)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                color: envelopeMode === mode ? "#43B3AE" : "#B4B4C0",
              }}
            >
              <span style={{
                width: 13, height: 13, borderRadius: "50%",
                border: `2px solid ${envelopeMode === mode ? "#43B3AE" : "#555"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {envelopeMode === mode && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#43B3AE" }} />
                )}
              </span>
              {mode}
            </label>
          ))}

          {envelopeMode === "Tolerance (%)" && (
            <div style={{ marginTop: 8 }}>
              <span style={labelStyle}>Tolerance Range</span>
              <select
                value={tolerancePct}
                onChange={(e) => setTolerancePct(parseInt(e.target.value))}
                style={selectStyle}
              >
                {[5, 10, 15, 20].map((v) => (
                  <option key={v} value={v}>± {v}%</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginTop: 10 }}>
            <span style={labelStyle}>Snapshot Duration</span>
            <select
              value={snapshotDuration}
              onChange={(e) => setSnapshotDuration(e.target.value)}
              style={selectStyle}
            >
              {["1 min", "2 min", "3 min"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {collapsed && (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {[Home, Route, RefreshCw, FolderOpen, Settings].map((Icon, index) => (
            <button
              key={index}
              onClick={() => {
                if (index === 0) router.push("/");
                if (index === 1) router.push("/road");
                if (index === 2) { onRefresh(); setCollapsed(false); }
                if (index === 3) { setMissionOpen(true); setCollapsed(false); }
                if (index === 4) { setConfigOpen(true); setCollapsed(false); }
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#d5dae4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
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


