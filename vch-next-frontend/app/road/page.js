"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import RoadSidebar from "../components/RoadSidebar";
import {
  Thermometer, Zap, Activity, Gauge, Battery, Cpu, FolderOpen,
  AlertTriangle, Bike, ChevronRight, Download, BarChart2, TrendingUp, Box, Repeat
} from "lucide-react";
import StreamlitSelect from "../components/StreamlitSelect";
import StreamlitMultiSelect from "../components/StreamlitMultiSelect";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8001";

const DARK_TOOLTIP = {
  hoverlabel: {
    bgcolor: "rgba(30,30,35,0.95)",
    bordercolor: "rgba(255,255,255,0.1)",
    font: { family: "Calibri, Segoe UI, Arial, sans-serif", color: "#FFF", size: 12 }
  }
};

const THERMAL_MAP = {
  IGBT: { col: "IGBT_Temp [C]", limit: 95.0, color: "#ffa500", label: "IGBT Temperature" },
  Motor: { col: "Motor_Temp [C]", limit: 125.0, color: "#ff4b4b", label: "Motor Temperature" },
  HighCell: { col: "highest_temp [C]", limit: 50.0, color: "#1f77b4", label: "High Cell Temperature", cellCol: "hight_cellno" },
  AFE: { col: "Pack_Overall_Temp [C]", limit: 50.0, color: "#00cc96", label: "Pack AFE Temperature" }
};

export default function RoadSuitePage() {
  const [rides, setRides] = useState([]);
  const [selectedRide, setSelectedRide] = useState("");
  const [rideData, setRideData] = useState(null);
  const [availableColumns, setAvailableColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [activeChannel, setActiveChannel] = useState("thermal");
  const [thermalChannels, setThermalChannels] = useState(["IGBT", "Motor", "HighCell", "AFE"]);
  const [thermalTab, setThermalTab] = useState("main");
  const [dynamicTab, setDynamicTab] = useState("main");
  const [deltaTSnapshot, setDeltaTSnapshot] = useState(120);
  const [customChannels, setCustomChannels] = useState(["Motor_Temp [C]", "Front_Speed [kph]", "Motor_Torque [Nm]"]);
  const [plotterMode, setPlotterMode] = useState("2d");
  const [xAxis, setXAxis] = useState("Time");
  const [leftYAxis, setLeftYAxis] = useState(["Motor_Temp [C]"]);
  const [rightYAxis, setRightYAxis] = useState(["Front_Speed [kph]"]);
  const [zAxis, setZAxis] = useState("None");
  const [showAxisSettings, setShowAxisSettings] = useState(false);
  const [axisSettings, setAxisSettings] = useState({
    xMin: "", xMax: "", yMin: "", yMax: "", y2Min: "", y2Max: "", zMin: "", zMax: ""
  });
  const [comparisonRides, setComparisonRides] = useState([]);
  const [comparisonData, setComparisonData] = useState({});
  const [timeRange, setTimeRange] = useState({ start: 0, end: 0 });
  const [showTimeFilter, setShowTimeFilter] = useState(false);

  useEffect(() => {
    loadRides();
  }, []);

  useEffect(() => {
    if (selectedRide) loadRideData(selectedRide);
    else {
      setRideData(null);
      setComparisonData({});
    }
  }, [selectedRide]);

  useEffect(() => {
    // Load data for any comparison rides that aren't loaded yet
    const missing = comparisonRides.filter(r => !comparisonData[r]);
    if (missing.length > 0) {
      missing.forEach(ride => loadComparisonData(ride));
    }
    // Clean up data for rides no longer in comparison
    const unused = Object.keys(comparisonData).filter(r => !comparisonRides.includes(r));
    if (unused.length > 0) {
      setComparisonData(prev => {
        const next = { ...prev };
        unused.forEach(r => delete next[r]);
        return next;
      });
    }
  }, [comparisonRides]);

  const loadComparisonData = (rideName) => {
    axios.get(`${API}/api/road/telemetry/${encodeURIComponent(rideName)}`)
      .then(r => {
        if (r.data && !r.data.error) {
          setComparisonData(prev => ({ ...prev, [rideName]: r.data }));
        }
      })
      .catch(err => console.error(`Failed to load comparison telemetry for ${rideName}:`, err));
  };

  const loadRides = () => {
    setLoading(true);
    setDataError(null);
    axios.get(`${API}/api/road/summaries`)
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : [];
        setRides(data);
        if (data.length > 0 && !selectedRide) {
          setSelectedRide(data[0].Ride_Name);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load rides:", err);
        setRides([]);
        setDataError("Failed to connect to API. Make sure the backend server is running.");
        setLoading(false);
      });
  };

  const loadRideData = (rideName) => {
    setLoadingData(true);
    setDataError(null);
    axios.get(`${API}/api/road/telemetry/${encodeURIComponent(rideName)}`)
      .then(r => {
        if (r.data && !r.data.error) {
          setRideData(r.data);
          setAvailableColumns(Object.keys(r.data));
          const maxTime = r.data.Time ? Math.max(...r.data.Time) : 0;
          setTimeRange({ start: 0, end: maxTime });
        } else {
          setDataError(r.data?.error || "Failed to load ride data");
          setRideData(null);
        }
        setLoadingData(false);
      })
      .catch(err => {
        console.error("Failed to load telemetry:", err);
        setDataError("Failed to load telemetry data");
        setRideData(null);
        setLoadingData(false);
      });
  };

  const getRouteType = (name) => {
    if (!name) return "Unknown";
    if (name.includes("Office")) return "Office Full Push";
    if (name.includes("Road")) return "Road Full Push";
    return "Untagged";
  };

  const selectedRideData = rides.find(r => r.Ride_Name === selectedRide);
  const currentRouteType = getRouteType(selectedRide);

  const getThermalData = (channel) => {
    const map = THERMAL_MAP[channel];
    if (!map || !rideData) return null;
    
    const keys = Object.keys(rideData);
    const colName = keys.find(k => k === map.col) || 
                    keys.find(k => k.toLowerCase().includes(channel.toLowerCase()) && k.toLowerCase().includes("temp")) ||
                    map.col;

    const colData = rideData[colName];
    const timeData = rideData.Time || rideData["Time (s)"] || rideData["time"];
    
    if (!colData || !timeData) return null;
    
    let maxVal = colData[0];
    let maxIdx = 0;
    colData.forEach((v, i) => { if (v > maxVal) { maxVal = v; maxIdx = i; } });
    
    let cellNo = null;
    if (map.cellCol && rideData[map.cellCol]) {
      cellNo = rideData[map.cellCol][maxIdx];
    }
    
    return {
      values: colData,
      time: timeData,
      max: maxVal,
      maxTime: timeData[maxIdx],
      limit: map.limit,
      color: map.color,
      cellNo
    };
  };

  const hasColumn = (colName) => availableColumns.includes(colName);

  const detectDeration = () => {
    let firstBreachTime = 999999;
    let derationMsg = null;
    
    for (const ch of thermalChannels) {
      const thermal = getThermalData(ch);
      if (!thermal) continue;
      
      for (let i = 0; i < thermal.values.length; i++) {
        if (thermal.values[i] > thermal.limit) {
          if (thermal.time[i] < firstBreachTime) {
            firstBreachTime = thermal.time[i];
            const cause = ch === 'HighCell' && thermal.cellNo ? `Cell #${Math.round(thermal.cellNo)}` : ch;
            derationMsg = { time: firstBreachTime, cause, channel: ch };
          }
          break;
        }
      }
    }
    return derationMsg;
  };

  const calculateDeltaT = (channel) => {
    const thermal = getThermalData(channel);
    if (!thermal || !thermal.values.length) return null;
    
    const startVal = thermal.values[0];
    const deltaT = thermal.values.map(v => v - startVal);
    
    return { time: thermal.time, deltaT, startVal };
  };

  const getDeltaTAtTime = (channel, snapshotTime) => {
    const deltaData = calculateDeltaT(channel);
    if (!deltaData) return null;
    
    let closestIdx = 0;
    let minDiff = Math.abs(deltaData.time[0] - snapshotTime);
    for (let i = 1; i < deltaData.time.length; i++) {
      const diff = Math.abs(deltaData.time[i] - snapshotTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return deltaData.deltaT[closestIdx];
  };

  const getNumericColumns = () => {
    if (!rideData) return [];
    return Object.keys(rideData).filter(col => {
      const val = rideData[col];
      return Array.isArray(val) && val.length > 0 && typeof val[0] === "number";
    });
  };

  const getColumnData = (col) => {
    if (!rideData || !rideData[col]) return null;
    return rideData[col];
  };

  const parseAxisValue = (val) => {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
  };

  const getFilteredTimeData = (col) => {
    const data = getColumnData(col);
    const timeData = rideData?.Time;
    if (!data || !timeData) return data;
    if (timeRange.end === 0 || timeRange.end === Math.max(...timeData)) return data;
    const startIdx = timeData.findIndex(t => t >= timeRange.start);
    const endIdx = timeData.findIndex(t => t > timeRange.end);
    if (startIdx === -1) return data;
    const endIndex = endIdx === -1 ? data.length : endIdx;
    return data.slice(startIdx, endIndex);
  };

  const getFilteredTimeIndex = () => {
    const timeData = rideData?.Time;
    if (!timeData) return { startIdx: 0, endIdx: timeData?.length || 0 };
    if (timeRange.end === 0 || timeRange.end === Math.max(...timeData)) {
      return { startIdx: 0, endIdx: timeData.length };
    }
    const startIdx = timeData.findIndex(t => t >= timeRange.start);
    const endIdx = timeData.findIndex(t => t > timeRange.end);
    return {
      startIdx: startIdx === -1 ? 0 : startIdx,
      endIdx: endIdx === -1 ? timeData.length : endIdx
    };
  };

  const getFilteredTime = () => {
    const timeData = rideData?.Time;
    if (!timeData) return timeData;
    const { startIdx, endIdx } = getFilteredTimeIndex();
    return timeData.slice(startIdx, endIdx);
  };

  const exportCSV = (data, filename) => {
    if (!data || Object.keys(data).length === 0) return;
    const headers = Object.keys(data).join(',');
    const rows = data.Time?.map((_, i) => 
      Object.values(data).map(col => Array.isArray(col) ? (col[i] ?? '') : col).join(',')
    ) || [];
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportThermalChannel = (channel) => {
    const map = THERMAL_MAP[channel];
    if (!map || !rideData) return;
    const exportData = { Time: getFilteredTime(), [map.col]: getFilteredTimeData(map.col) };
    exportCSV(exportData, `${selectedRide}_${channel}_Temp.csv`);
  };

  const exportAllThermals = () => {
    const exportData = { Time: getFilteredTime() };
    thermalChannels.forEach(ch => {
      const map = THERMAL_MAP[ch];
      if (map) exportData[map.col] = getFilteredTimeData(map.col);
    });
    exportCSV(exportData, `${selectedRide}_Combined_Thermals.csv`);
  };

  const exportDeltaT = (channel) => {
    const map = THERMAL_MAP[channel];
    if (!map || !rideData) return;
    const colData = getFilteredTimeData(map.col);
    const timeData = getFilteredTime();
    if (!colData || !timeData) return;
    const startVal = colData[0];
    const deltaT = colData.map(v => v - startVal);
    const exportData = { Time: timeData, [`${channel}_dT`]: deltaT };
    exportCSV(exportData, `${selectedRide}_${channel}_DeltaT.csv`);
  };

  const exportSandboxData = () => {
    if (!rideData) return;
    const exportData = {};
    const cols = [xAxis, ...leftYAxis, ...rightYAxis, zAxis !== "None" ? zAxis : null].filter(Boolean);
    cols.forEach(col => {
      exportData[col] = getFilteredTimeData(col);
    });
    exportCSV(exportData, `road_sandbox_${selectedRide}.csv`);
  };

  const renderMetricCard = (title, value, unit, limit, state, color, extra = "") => {
    const isSpecial = state === "gold" || state === "breach";
    return (
      <div className={`metric-card ${state}`} style={{
        background: `linear-gradient(135deg, ${color}25 0%, rgba(25,27,32,0.8) 100%)`,
        backdropFilter: "blur(20px)",
        border: `1px solid ${color}80`,
        borderRadius: 16,
        padding: "20px 24px",
        boxShadow: isSpecial 
          ? `0 12px 35px ${color}40, inset 0 1px 0 rgba(255,255,255,0.1)` 
          : `0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition: "all 0.3s ease",
        position: "relative",
        overflow: "hidden"
      }}>
        <div className="metric-title" style={{ color: "#fff", opacity: 0.9, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
          {title}
        </div>
        <div className="metric-value" style={{ 
          color: "#fff", 
          fontSize: 34, 
          fontWeight: 900, 
          marginBottom: 6, 
          letterSpacing: -1,
          textShadow: isSpecial ? `0 0 15px ${color}60` : "none"
        }}>
          {value} <span style={{ fontSize: 16, opacity: 0.7, fontWeight: 600, textShadow: "none" }}>{unit}</span>
        </div>
        {extra && <div className="metric-sub" style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500, marginBottom: 16 }}>{extra}</div>}
        
        <div style={{ 
          marginTop: "auto",
          paddingTop: 16, 
          borderTop: `1px solid ${color}40`, 
          display: "flex", 
          justifyContent: "flex-start", 
          alignItems: "center",
          fontSize: 11, 
          fontWeight: 700, 
          color: "rgba(255,255,255,0.6)"
        }}>
          Limit: {limit}{unit} 
          <span style={{ margin: "0 8px", color: "rgba(255,255,255,0.2)" }}>|</span> 
          <span style={{ 
            color: state === "safe" ? "#00CC96" : state === "gold" ? "#FFD700" : "#ff4b4b",
            display: "flex", 
            alignItems: "center", 
            letterSpacing: 0.5
          }}>
            {state === "safe" ? "✅ SAFE" : state === "gold" ? "⚠️ DERATED" : "⚠️ BREACH"}
          </span>
        </div>
      </div>
    );
  };

  const renderChart = (title, traces, height = 650) => (
    <div style={{ 
      background: "rgba(25,27,32,0.65)", 
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.08)", 
      borderRadius: 20, 
      padding: 24, 
      marginBottom: 24,
      boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
    }}>
      <h3 style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 20, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 10 }}>
        <Activity size={18} color="#43B3AE" /> {title}
      </h3>
      <div style={{ height }}>
        <Plot
          data={traces}
          layout={{
            autosize: true, height,
            paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: "#fff", family: "'Outfit', sans-serif" },
            margin: { l: 65, r: 25, t: 30, b: 100 },
            xaxis: { 
              showgrid: true, gridcolor: "rgba(255,255,255,0.18)", 
              showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
              zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
              title: { text: "Time (s)", font: { color: "#fff", weight: 800 } },
              tickfont: { weight: 600, color: "#fff" }
            },
            yaxis: { 
              showgrid: true, gridcolor: "rgba(255,255,255,0.18)",
              showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
              zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
              tickfont: { weight: 600, color: "#fff" }
            },
            legend: { 
              orientation: "h", y: -0.15, x: 0.5, xanchor: "center", yanchor: "top", 
              font: { color: "#fff", size: 11, weight: 600 } 
            },
            hovermode: "x unified",
            ...DARK_TOOLTIP,
          }}
          config={{ displayModeBar: true, responsive: true }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <RoadSidebar
        rides={rides}
        selectedRide={selectedRide}
        setSelectedRide={setSelectedRide}
        comparisonRides={comparisonRides}
        setComparisonRides={setComparisonRides}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        onRefresh={loadRides}
        showTimeFilter={showTimeFilter}
        setShowTimeFilter={setShowTimeFilter}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        exportAllThermals={exportAllThermals}
        maxTime={rideData?.Time ? Math.max(...rideData.Time) : 0}
      />

      <main className="main-content">
        <div className="fade-in">
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: -1, marginBottom: 4 }}>
              Road Test Monitor
            </h1>
            <div style={{ fontSize: 14, color: "#A0A0AB" }}>
              Target: <span style={{ color: "#43B3AE", fontWeight: 700 }}>{selectedRide || "No ride selected"}</span>
            </div>
          </div>

          {/* Route Info Bar */}
          {selectedRideData && (
            <div style={{
              background: "rgba(25,27,32,0.7)", 
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 18, 
              padding: "18px 24px", 
              marginBottom: 30,
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              gap: 20, 
              flexWrap: "wrap",
              boxShadow: "0 12px 40px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 4 }}>Test Route</div>
                <div style={{ color: "#43B3AE", fontWeight: 700, fontSize: 14 }}>{currentRouteType}</div>
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", height: 30 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 4 }}>Rider / Temp</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                  {selectedRideData.Rider || "Unknown"} / {selectedRideData.Ambient_Temp_C || 0}°C
                </div>
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", height: 30 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 4 }}>Distance / Time</div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
                  {selectedRideData.Total_Distance_km || 0} km / {rideData?.Time ? Math.round(Math.max(...rideData.Time)) : 0} s
                </div>
              </div>
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", height: 30 }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 4 }}>ML Drive Score</div>
                <div style={{ color: "#43B3AE", fontWeight: 700, fontSize: 14 }}>
                  {selectedRideData.Drive_Score || 0} ({selectedRideData.Ride_Class || "Unknown"})
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {dataError && (
            <div style={{ background: "rgba(255,75,75,0.1)", border: "1px solid rgba(255,75,75,0.3)", borderRadius: 12, padding: 20, marginBottom: 20, textAlign: "center" }}>
              <AlertTriangle size={32} color="#ff4b4b" style={{ marginBottom: 10 }} />
              <div style={{ color: "#ff4b4b", fontWeight: 700, marginBottom: 5 }}>Error</div>
              <div style={{ color: "#A0A0AB", fontSize: 14 }}>{dataError}</div>
            </div>
          )}

          {/* Loading State */}
          {loadingData && (
            <div style={{ textAlign: "center", padding: 40, color: "#A0A0AB" }}>
              <Activity size={32} style={{ marginBottom: 10, animation: "spin 1s linear infinite" }} />
              <div>Loading telemetry data...</div>
            </div>
          )}

          {/* No Rides State */}
          {!loading && rides.length === 0 && !dataError && (
            <div style={{ textAlign: "center", padding: 60, background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
              <Bike size={64} color="#666" style={{ marginBottom: 20 }} />
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 12 }}>No Rides Found</h2>
              <p style={{ fontSize: 14, color: "#A0A0AB", maxWidth: 400, margin: "0 auto" }}>
                Upload road test data through the Data Engine to see thermal analytics here.
              </p>
            </div>
          )}

          {/* Content based on active channel */}
          {activeChannel === "thermal" && rideData && !loadingData && (
            <>
              {/* Channel Toggles with Glassmorphism */}
              <div style={{
                display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap", alignItems: "center",
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)"
              }}>
                <span style={{ fontSize: 12, color: "#fff", fontWeight: 700, marginRight: 8, textTransform: "uppercase", letterSpacing: 1 }}>Channels:</span>
                {Object.keys(THERMAL_MAP).map(ch => {
                  const isActive = thermalChannels.includes(ch);
                  const map = THERMAL_MAP[ch];
                  return (
                    <button
                      key={ch}
                      onClick={() => {
                        if (isActive) {
                          setThermalChannels(thermalChannels.filter(c => c !== ch));
                        } else {
                          setThermalChannels([...thermalChannels, ch]);
                        }
                      }}
                      style={{
                        padding: "8px 16px", borderRadius: 10,
                        background: isActive ? `${map.color}25` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${isActive ? map.color : "rgba(255,255,255,0.1)"}`,
                        color: isActive ? map.color : "#888",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>

              {/* Thermal Tabs - Glassmorphism Style */}
              <div style={{
                display: "flex",
                gap: 8,
                marginBottom: 32,
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 16,
                padding: 8,
                width: "fit-content",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
              }}>
                {[
                  { id: "main", label: "Primary Dashboard", icon: <BarChart2 size={16} /> },
                  { id: "deltaT", label: "Cumulative Rise (ΔT)", icon: <TrendingUp size={16} /> },
                  { id: "custom", label: "Dynamic 3D Plotter", icon: <Box size={16} /> }
                ].map(tab => {
                  const isActive = thermalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setThermalTab(tab.id)}
                      style={{
                        padding: "12px 20px",
                        borderRadius: 12,
                        background: isActive ? "#43B3AE" : "rgba(255,255,255,0.03)",
                        color: isActive ? "#fff" : "#A0A0AB",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: isActive ? "0 4px 15px rgba(67, 179, 174, 0.3)" : "none"
                      }}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Deration Banner */}
              {(() => {
                const deration = detectDeration();
                if (!deration) return null;
                return (
                  <div className="deration-banner">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <AlertTriangle size={20} />
                      <span>
                        First Deration Detected: <strong>{deration.cause}</strong> crossed safety limit at {deration.time.toFixed(1)}s (Caused by {deration.channel})
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* TAB: MAIN DASHBOARD */}
              {thermalTab === "main" && (
                <>
                  {thermalChannels.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "#A0A0AB" }}>
                      Select at least one thermal channel to display.
                    </div>
                  )}

                  {thermalChannels.length > 0 && (
                    <>
                      {/* Thermal Metric Cards with Glassmorphism */}
                      <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#A0A0AB", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Thermal Summary</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                        {thermalChannels.map(ch => {
                          const thermal = getThermalData(ch);
                          const map = THERMAL_MAP[ch];
                          
                          if (!thermal) {
                            return (
                              <div key={ch} className="metric-card">
                                <div className="metric-title">{ch}</div>
                                <div style={{ color: "#666", fontSize: 14, marginTop: 20 }}>No data</div>
                              </div>
                            );
                          }
                          const deration = detectDeration();
                          const isBreach = thermal.max >= thermal.limit;
                          const isGold = deration && deration.channel === ch;
                          const state = isGold ? "gold" : isBreach ? "breach" : "safe";
                          const statusColor = state === "gold" ? "#FFD700" : state === "breach" ? "#ff4b4b" : "#00CC96";
                          
                          const extraInfo = thermal.cellNo ? `Cell #${Math.round(thermal.cellNo)}` : `Peak @ ${thermal.maxTime?.toFixed(0) || 0}s`;
                          
                          return (
                            <div key={ch}>
                              {renderMetricCard(
                                `${ch} Raw MAX Temp`,
                                thermal.max.toFixed(1),
                                "°C",
                                thermal.limit,
                                state,
                                statusColor,
                                extraInfo
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Individual Thermal Curves with Glassmorphism */}
                      <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#A0A0AB", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Individual Thermal Profiles</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                          {thermalChannels.map(ch => {
                            const thermal = getThermalData(ch);
                            const map = THERMAL_MAP[ch];
                            const filteredTime = getFilteredTime();
                            const filteredData = getFilteredTimeData(map.col);

                            if (!thermal) return null;

                            const limitLine = [{
                              x: filteredTime,
                              y: Array(filteredTime.length).fill(thermal.limit),
                              type: "scatter",
                              mode: "lines",
                              name: "Limit",
                              line: { color: "rgba(255,75,75,0.7)", width: 2, dash: "dash" }
                            }];

                            return (
                              <div key={ch} style={{
                                background: "rgba(255,255,255,0.05)",
                                backdropFilter: "blur(20px)",
                                WebkitBackdropFilter: "blur(20px)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 20,
                                padding: 24,
                                boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                              }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{map.label}</h3>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={{ fontSize: 10, color: "#ff4b4b", background: "rgba(255,75,75,0.15)", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>
                                    Limit: {map.limit}°C
                                  </span>
                                  <button
                                    onClick={() => exportThermalChannel(ch)}
                                    style={{
                                      padding: "4px 8px", borderRadius: 6, background: "rgba(67,179,174,0.1)",
                                      border: "1px solid rgba(67,179,174,0.2)", color: "#43B3AE",
                                      fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                                    }}
                                  >
                                    <Download size={12} /> Export
                                  </button>
                                </div>
                              </div>
                              <Plot
                                data={[
                                  {
                                    x: filteredTime,
                                    y: filteredData,
                                    type: "scatter",
                                    mode: "lines",
                                    name: `⭐ ${selectedRide}`,
                                    line: { color: map.color, width: 3.0 }
                                  },
                                  ...comparisonRides.map(r => {
                                    const cmp = comparisonData[r];
                                    if (!cmp || !cmp[map.col]) return null;
                                    const cmpTime = cmp.Time || cmp["Time (s)"] || cmp["time"];
                                    const { startIdx, endIdx } = getFilteredTimeIndex();
                                    return {
                                      x: cmpTime?.slice(startIdx, endIdx),
                                      y: cmp[map.col]?.slice(startIdx, endIdx),
                                      type: "scatter",
                                      mode: "lines",
                                      name: `🔄 ${r}`,
                                      line: { color: map.color, width: 1.8, dash: "dot" },
                                      opacity: 0.6
                                    };
                                  }).filter(Boolean),
                                  ...limitLine
                                ]}
                                layout={{
                                  autosize: true, height: 360,
                                  paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                                  font: { color: "#fff", family: "'Outfit', sans-serif" },
                                  margin: { l: 45, r: 15, t: 20, b: 80 },
                                  xaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.2)", gridwidth: 2, title: { text: "Time (s)", font: { color: "#fff", weight: 700 } } },
                                  yaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.2)", gridwidth: 2, title: { text: "Temp (°C)", font: { color: "#fff", weight: 700 } } },
                                  legend: { orientation: "h", y: -0.25, x: 0.5, xanchor: "center", yanchor: "top", font: { color: "#fff", size: 10 } },
                                  hovermode: "x unified",
                                  ...DARK_TOOLTIP,
                                }}
                                config={{ displayModeBar: true, responsive: true }}
                                style={{ width: "100%", height: 360 }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Combined Thermal Overlay with Glassmorphism */}
                      <div style={{ marginBottom: 40 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#A0A0AB", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Combined Thermal Overlay</h3>
                        <div style={{
                          background: "rgba(255,255,255,0.05)",
                          backdropFilter: "blur(20px)",
                          WebkitBackdropFilter: "blur(20px)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 20,
                          padding: 24,
                          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                        }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                          <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>Combined Thermal Overlay</h3>
                          <button
                            onClick={exportAllThermals}
                            style={{
                              padding: "6px 12px", borderRadius: 8, background: "rgba(67,179,174,0.1)",
                              border: "1px solid rgba(67,179,174,0.2)", color: "#43B3AE",
                              fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                            }}
                          >
                            <Download size={12} /> Export Combined
                          </button>
                        </div>
                        <div style={{ height: 550 }}>
                          <Plot
                            data={[
                              ...thermalChannels
                                .filter(ch => getThermalData(ch))
                                .map(ch => {
                                  const map = THERMAL_MAP[ch];
                                  return {
                                    x: getFilteredTime(),
                                    y: getFilteredTimeData(map.col),
                                    type: "scatter",
                                    mode: "lines",
                                    name: `⭐ ${ch}`,
                                    line: { color: map.color, width: 3.0 }
                                  };
                                }),
                              ...comparisonRides.flatMap(r => {
                                const cmp = comparisonData[r];
                                if (!cmp) return [];
                                const { startIdx, endIdx } = getFilteredTimeIndex();
                                return thermalChannels
                                  .filter(ch => cmp[THERMAL_MAP[ch].col])
                                  .map(ch => {
                                    const map = THERMAL_MAP[ch];
                                    const cmpTime = cmp.Time || cmp["Time (s)"] || cmp["time"];
                                    return {
                                      x: cmpTime?.slice(startIdx, endIdx),
                                      y: cmp[map.col]?.slice(startIdx, endIdx),
                                      type: "scatter",
                                      mode: "lines",
                                      name: `🔄 ${r} - ${ch}`,
                                      line: { color: map.color, width: 1.8, dash: "dot" },
                                      opacity: 0.5
                                    };
                                  });
                              })
                            ]}
                            layout={{
                              autosize: true, height: 550,
                              paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                              font: { color: "#fff", family: "'Outfit', sans-serif" },
                              margin: { l: 65, r: 25, t: 30, b: 100 },
                              xaxis: {
                                showgrid: true, gridcolor: "rgba(255,255,255,0.18)",
                                showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                                zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                                title: { text: "Time (s)", font: { color: "#fff", weight: 800 } },
                                tickfont: { weight: 600, color: "#fff" }
                              },
                              yaxis: {
                                showgrid: true, gridcolor: "rgba(255,255,255,0.18)",
                                showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                                zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                                title: { text: "Temperature (°C)", font: { color: "#fff", weight: 800 } },
                                tickfont: { weight: 600, color: "#fff" }
                              },
                              legend: {
                                orientation: "h", y: -0.15, x: 0.5, xanchor: "center", yanchor: "top",
                                font: { color: "#fff", size: 11, weight: 600 }
                              },
                              hovermode: "x unified",
                              ...DARK_TOOLTIP,
                            }}
                            config={{ displayModeBar: true, displaylogo: false, responsive: true }}
                            style={{ width: "100%", height: 550 }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                  )}
                </>
              )}

              {/* TAB: DELTA T (CUMULATIVE RISE) */}
              {thermalTab === "deltaT" && (
                <>
                  {(() => {
                    const maxTime = rideData?.Time ? Math.max(...rideData.Time) : 0;
                    return (
                      <div style={{
                        marginBottom: 32,
                        background: "rgba(255,255,255,0.05)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 16,
                        padding: 20,
                        boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Snapshot Evaluator</h3>
                          <span style={{ color: "#43B3AE", fontWeight: 700, fontSize: 14 }}>@ {deltaTSnapshot}s</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={Math.floor(maxTime / 10) * 10}
                          value={deltaTSnapshot}
                          onChange={(e) => setDeltaTSnapshot(parseInt(e.target.value))}
                          style={{ width: "100%" }}
                        />
                      </div>
                    );
                  })()}

                  {/* Delta T Metric Cards with Glassmorphism */}
                  <div style={{ marginBottom: 32 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#A0A0AB", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Cumulative Rise Summary</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                      {thermalChannels.map(ch => {
                        const dT = getDeltaTAtTime(ch, deltaTSnapshot);
                        const map = THERMAL_MAP[ch];
                        return (
                          <div key={ch} style={{
                            background: "rgba(255,255,255,0.05)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                            border: `1px solid ${map.color}44`,
                            borderRadius: 16,
                            padding: 20,
                            textAlign: "center",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
                          }}>
                            <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", marginBottom: 8, fontWeight: 700 }}>{ch} Accumulated Heat</div>
                            <div style={{ fontSize: 32, fontWeight: 800, color: "#FF4081" }}>
                              +{dT?.toFixed(1) || "0.0"} <span style={{ fontSize: 14, color: "#888" }}>°C</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Delta T Charts with Glassmorphism */}
                  <div style={{ marginBottom: 40 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#A0A0AB", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Cumulative Rise Profiles</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    {thermalChannels.map(ch => {
                      const map = THERMAL_MAP[ch];
                      const filteredTime = getFilteredTime();
                      const filteredColData = getFilteredTimeData(map.col);
                      if (!filteredTime || !filteredColData) return null;

                      const startVal = filteredColData[0];
                      const filteredDeltaT = filteredColData.map(v => v - startVal);
                      const snapshotIdx = Math.min(
                        filteredTime.findIndex(t => t >= deltaTSnapshot) || 0,
                        filteredDeltaT.length - 1
                      );

                      return (
                        <div key={ch} style={{
                          background: "rgba(255,255,255,0.05)",
                          backdropFilter: "blur(20px)",
                          WebkitBackdropFilter: "blur(20px)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 20,
                          padding: 24,
                          boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{map.label} - Cumulative Rise</h3>
                            <button
                              onClick={() => exportDeltaT(ch)}
                              style={{
                                padding: "4px 8px", borderRadius: 6, background: "rgba(67,179,174,0.1)",
                                border: "1px solid rgba(67,179,174,0.2)", color: "#43B3AE",
                                fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                              }}
                            >
                              <Download size={12} /> Export
                            </button>
                          </div>
                          <Plot
                            data={[
                              {
                                x: filteredTime,
                                y: filteredDeltaT,
                                type: "scatter",
                                mode: "lines+markers",
                                name: `⭐ ${selectedRide}`,
                                line: { color: "#FF4081", width: 2.5 },
                                marker: { size: 4 }
                              },
                              ...comparisonRides.map(r => {
                                const cmp = comparisonData[r];
                                if (!cmp || !cmp[map.col]) return null;
                                const { startIdx, endIdx } = getFilteredTimeIndex();
                                const cmpTime = cmp.Time || cmp["Time (s)"] || cmp["time"];
                                const cmpFiltered = cmpTime?.slice(startIdx, endIdx);
                                const cmpColFiltered = cmp[map.col]?.slice(startIdx, endIdx);
                                if (!cmpFiltered || !cmpColFiltered) return null;
                                const cmpStartVal = cmpColFiltered[0];
                                const cmpDt = cmpColFiltered.map(v => v - cmpStartVal);
                                return {
                                  x: cmpFiltered,
                                  y: cmpDt,
                                  type: "scatter",
                                  mode: "lines",
                                  name: `🔄 ${r}`,
                                  line: { color: "#FF4081", width: 1, dash: "dot" },
                                  opacity: 0.6
                                };
                              }).filter(Boolean),
                              {
                                x: [deltaTSnapshot, deltaTSnapshot],
                                y: [Math.min(...filteredDeltaT), Math.max(...filteredDeltaT)],
                                type: "scatter",
                                mode: "lines",
                                name: "Snapshot",
                                line: { color: "#00FFFF", width: 2, dash: "dash" }
                              }
                            ]}
                            layout={{
                              autosize: true, height: 360,
                              paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                              font: { color: "#fff" },
                              margin: { l: 45, r: 15, t: 20, b: 80 },
                              xaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.2)", gridwidth: 2, title: { text: "Time (s)", font: { color: "#fff", weight: 700 } } },
                              yaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.2)", gridwidth: 2, title: { text: "ΔT (°C)", font: { color: "#fff", weight: 700 } } },
                              legend: { orientation: "h", y: -0.25, x: 0.5, xanchor: "center", yanchor: "top", font: { color: "#fff", size: 10 } },
                              hovermode: "x unified",
                            }}
                            config={{ displayModeBar: true, responsive: true }}
                            style={{ width: "100%", height: 360 }}
                          />
                        </div>
                      );
                    })}
                    </div>
                  </div>
                </>
              )}

              {/* TAB: DYNAMIC 3D PLOTTER */}
              {thermalTab === "custom" && (
                <div className="fade-in" style={{ marginBottom: 20 }}>
                  {/* Control Panel */}
                  <div className="sandbox-panel" style={{ 
                    position: "relative",
                    zIndex: 100,
                    background: "rgba(25,25,30,0.45)", 
                    backdropFilter: "blur(20px)", 
                    border: "1px solid rgba(67,179,174,0.18)", 
                    borderRadius: 18, 
                    padding: 24, 
                    marginBottom: 24,
                    boxShadow: "0 14px 44px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                  }}>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                      <Activity size={18} color="#43B3AE" /> Dynamic Multi-Axis Plotter & Sandbox
                    </h3>
                    
                    {/* Axis Selectors Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20 }}>
                      {/* X-Axis */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: "#A0A0AB", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>X-Axis</label>
                        <StreamlitSelect 
                          value={xAxis} 
                          onChange={setXAxis} 
                          options={getNumericColumns()} 
                        />
                      </div>
                      
                      {/* Left Y-Axis */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: "#43B3AE", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Left Y-Axis (Primary)</label>
                        <StreamlitMultiSelect 
                          value={leftYAxis} 
                          onChange={setLeftYAxis} 
                          options={getNumericColumns()} 
                          placeholder="Select Primary Series"
                        />
                      </div>
                      
                      {/* Right Y-Axis */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: "#FF6080", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Right Y-Axis (Secondary)</label>
                        <StreamlitMultiSelect 
                          value={rightYAxis} 
                          onChange={setRightYAxis} 
                          options={getNumericColumns()} 
                          placeholder="Select Secondary Series"
                        />
                      </div>
                      
                      {/* Z-Axis / Mode */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 800, color: "#ab63fa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "block" }}>Z-Axis / 3D Mode</label>
                        <StreamlitSelect 
                          value={zAxis} 
                          onChange={(val) => { setZAxis(val); setPlotterMode(val === "None" ? "2d" : "3d"); }} 
                          options={["None", ...getNumericColumns()]} 
                        />
                      </div>
                    </div>
                    
                    {/* Axis Scaling Accordion */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 18 }}>
                      <button
                        onClick={() => setShowAxisSettings(!showAxisSettings)}
                        style={{ background: "transparent", border: "none", color: "#A0A0AB", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0 }}
                      >
                        <ChevronRight size={14} style={{ transform: showAxisSettings ? "rotate(90deg)" : "rotate(0)", transition: "0.2s" }} />
                        Custom Axis Scaling (Min / Max Limits)
                      </button>
                      
                      {showAxisSettings && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
                          <div>
                            <label style={{ fontSize: 10, color: "#666" }}>X Min</label>
                            <input type="number" value={axisSettings.xMin} onChange={(e) => setAxisSettings({...axisSettings, xMin: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#666" }}>X Max</label>
                            <input type="number" value={axisSettings.xMax} onChange={(e) => setAxisSettings({...axisSettings, xMax: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#43B3AE" }}>Y Min</label>
                            <input type="number" value={axisSettings.yMin} onChange={(e) => setAxisSettings({...axisSettings, yMin: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#43B3AE" }}>Y Max</label>
                            <input type="number" value={axisSettings.yMax} onChange={(e) => setAxisSettings({...axisSettings, yMax: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#FF6080" }}>Y2 Min</label>
                            <input type="number" value={axisSettings.y2Min} onChange={(e) => setAxisSettings({...axisSettings, y2Min: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#FF6080" }}>Y2 Max</label>
                            <input type="number" value={axisSettings.y2Max} onChange={(e) => setAxisSettings({...axisSettings, y2Max: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#ab63fa" }}>Z Min</label>
                            <input type="number" value={axisSettings.zMin} onChange={(e) => setAxisSettings({...axisSettings, zMin: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#ab63fa" }}>Z Max</label>
                            <input type="number" value={axisSettings.zMax} onChange={(e) => setAxisSettings({...axisSettings, zMax: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Plot Area */}
                  <div className="sandbox-panel" style={{ 
                    background: "rgba(25,25,30,0.45)", 
                    backdropFilter: "blur(20px)", 
                    border: "1px solid rgba(67,179,174,0.18)", 
                    borderRadius: 18, 
                    padding: 24, 
                    marginBottom: 20,
                    boxShadow: "0 14px 44px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                  }}>
                    {plotterMode === "3d" ? (
                      <Plot
                        data={leftYAxis.flatMap((col, i) => {
                          const xData = getFilteredTimeData(xAxis);
                          const yData = getFilteredTimeData(col);
                          const zData = getFilteredTimeData(zAxis);
                          if (!xData || !yData || !zData) return [];
                          return [{
                            x: xData, y: yData, z: zData,
                            type: "scatter3d",
                            mode: "markers",
                            name: col,
                            marker: { size: 4, color: ["#43B3AE", "#FF6080", "#FFA15A", "#CFFF60"][i % 4], opacity: 0.8 }
                          }];
                        })}
                        layout={{
                          autosize: true, height: 700,
                          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                          font: { color: "#fff", family: "'Outfit', sans-serif" },
                          ...DARK_TOOLTIP,
                            scene: {
                              xaxis: { title: { text: xAxis, font: { color: "#fff", size: 12 } }, gridcolor: "rgba(255,255,255,0.1)", backgroundcolor: "rgba(0,0,0,0)" },
                              yaxis: { title: { text: "Y", font: { color: "#fff", size: 12 } }, gridcolor: "rgba(255,255,255,0.1)", backgroundcolor: "rgba(0,0,0,0)" },
                              zaxis: { title: { text: zAxis, font: { color: "#fff", size: 12 } }, gridcolor: "rgba(255,255,255,0.1)", backgroundcolor: "rgba(0,0,0,0)" },
                              bgcolor: "rgba(7,11,16,1)"
                            },
                            legend: { orientation: "h", y: -0.1, x: 0.5, xanchor: "center", font: { color: "#fff" } },
                            margin: { b: 80 }
                          }}
                        config={{ displayModeBar: true, responsive: true }}
                        style={{ width: "100%", height: 700 }}
                      />
                    ) : (
                      <Plot
                        data={[
                          ...leftYAxis.map((col, i) => ({
                            x: getFilteredTimeData(xAxis),
                            y: getFilteredTimeData(col),
                            type: "scatter",
                            mode: "lines",
                            name: col,
                            line: { color: ["#43B3AE", "#00CC96", "#1f77b4", "#ffa500"][i % 4], width: 3.0 },
                            yaxis: "y"
                          })),
                          ...rightYAxis.map((col, i) => ({
                            x: getFilteredTimeData(xAxis),
                            y: getFilteredTimeData(col),
                            type: "scatter",
                            mode: "lines",
                            name: col,
                            line: { color: ["#FF6080", "#FFA15A", "#CFFF60", "#ab63fa"][i % 4], width: 3.0 },
                            yaxis: "y2"
                          }))
                        ]}
                        layout={{
                          autosize: true, height: 750,
                          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                          font: { color: "#fff", family: "'Outfit', sans-serif" },
                          ...DARK_TOOLTIP,
                          margin: { l: 70, r: 70, t: 40, b: 120 },
                          xaxis: { 
                            showgrid: true, gridcolor: "rgba(255,255,255,0.18)", 
                            showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                            zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                            title: { text: xAxis, font: { color: "#fff", weight: 800 } },
                            tickfont: { weight: 600, color: "#fff" },
                            range: [parseAxisValue(axisSettings.xMin) || null, parseAxisValue(axisSettings.xMax) || null]
                          },
                          yaxis: { 
                            showgrid: true, gridcolor: "rgba(255,255,255,0.18)",
                            showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                            zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                            title: { text: "Primary Axis", font: { color: "#43B3AE", weight: 800 } },
                            tickfont: { weight: 600, color: "#fff" },
                            side: "left",
                            range: [parseAxisValue(axisSettings.yMin) || null, parseAxisValue(axisSettings.yMax) || null]
                          },
                          yaxis2: {
                            showgrid: false, gridcolor: "rgba(255,255,255,0.18)",
                            showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                            zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                            title: { text: "Secondary Axis", font: { color: "#FF6080", weight: 800 } },
                            tickfont: { weight: 600, color: "#fff" },
                            side: "right", overlaying: "y",
                            range: [parseAxisValue(axisSettings.y2Min) || null, parseAxisValue(axisSettings.y2Max) || null]
                          },
                          legend: { 
                            orientation: "h", yanchor: "top", y: -0.15, xanchor: "center", x: 0.5, 
                            font: { color: "#fff", weight: 600 } 
                          },
                          hovermode: "x unified",
                        }}
                        config={{ displayModeBar: true, displaylogo: false, responsive: true }}
                        style={{ width: "100%", height: 750 }}
                      />
                    )}
                  </div>

                  {/* Export Button */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={exportSandboxData}
                      style={{ padding: "12px 24px", background: "rgba(67,179,174,0.15)", border: "1px solid rgba(67,179,174,0.3)", borderRadius: 10, color: "#43B3AE", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Export Thermal Sandbox Data
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {activeChannel === "dynamic" && rideData && !loadingData && (
            <>
              {/* Dynamic Tabs - Pill Style */}
              <div style={{ 
                display: "flex", 
                gap: 8, 
                marginBottom: 24, 
                background: "rgba(255,255,255,0.02)", 
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 14, 
                padding: 6,
                width: "fit-content"
              }}>
                {[
                  { id: "main", label: "Primary Dashboard", icon: <BarChart2 size={16} /> },
                  { id: "custom", label: "Dynamic 3D Plotter", icon: <Box size={16} /> }
                ].map(tab => {
                  const isActive = dynamicTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setDynamicTab(tab.id)}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 10,
                        background: isActive ? "#43B3AE" : "transparent",
                        color: isActive ? "#fff" : "#A0A0AB",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: isActive ? "0 4px 15px rgba(67, 179, 174, 0.3)" : "none"
                      }}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {dynamicTab === "main" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                    {renderMetricCard("Total Distance", selectedRideData?.Total_Distance_km?.toFixed(1) || 0, "km", 100, "safe", "#43B3AE")}
                    {renderMetricCard("Energy Consumed", selectedRideData?.Total_Energy_Wh?.toFixed(0) || 0, "Wh", 5000, "safe", "#43B3AE")}
                    {renderMetricCard("High Torque", selectedRideData?.High_Torque_Time_sec?.toFixed(0) || 0, "sec", 120, "safe", "#43B3AE")}
                    {renderMetricCard("Drive Score", selectedRideData?.Drive_Score || 0, "pts", 100, "safe", "#43B3AE")}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    {[
                      "Front_Speed [kph]", "RPM [RPM]", "Instant_Power [W]", 
                      "Motor_Torque [Nm]", "Throttle", "soc", "DC_Volatge [V]"
                    ].map(ch => {
                      if (!hasColumn(ch)) return null;
                      const data = rideData[ch];
                      const time = rideData.Time;
                      
                      const colorMap = {
                        "Front_Speed [kph]": "#636efa",
                        "RPM [RPM]": "#ef553b",
                        "Instant_Power [W]": "#00cc96",
                        "Motor_Torque [Nm]": "#ab63fa",
                        "Throttle": "#ffa500",
                        "soc": "#CFFF60",
                        "DC_Volatge [V]": "#17BECF"
                      };
                      const color = colorMap[ch] || "#43B3AE";
                      const unit = ch.includes("[") ? ch.split("[")[1].split("]")[0] : 
                                   ch === "soc" ? "%" : 
                                   ch === "Throttle" ? "%" : "";
                      
                      return (
                        <div key={ch} style={{ 
                          background: "rgba(25,27,32,0.65)", 
                          backdropFilter: "blur(20px)",
                          border: "1px solid rgba(255,255,255,0.08)", 
                          borderRadius: 20, 
                          padding: 24, 
                          marginBottom: 4,
                          boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                        }}>
                          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                            <Activity size={14} style={{ color }} /> {ch} Profile
                          </h3>
                          <Plot
                            data={[{
                              x: time, y: data,
                              type: "scatter", mode: "lines",
                              name: ch,
                              line: { color, width: 2.5 }
                            }]}
                            layout={{
                              autosize: true, height: 350,
                              paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                              font: { color: "#fff", family: "'Outfit', sans-serif" },
                              margin: { l: 65, r: 25, t: 20, b: 80 },
                              xaxis: { 
                                showgrid: true, gridcolor: "rgba(255,255,255,0.12)", 
                                title: { text: "Time (s)", font: { color: "#fff", weight: 800 } },
                              },
                              yaxis: { 
                                showgrid: true, gridcolor: "rgba(255,255,255,0.12)", 
                                title: { text: unit ? `${ch.split(" [")[0]} (${unit})` : ch, font: { color: "#fff", weight: 800 } },
                              },
                              showlegend: true,
                              legend: { orientation: "h", y: -0.22, x: 0.5, xanchor: "center", yanchor: "top", font: { size: 10, color: "#fff" } },
                              hovermode: "x unified",
                              ...DARK_TOOLTIP,
                            }}
                            config={{ displayModeBar: true, responsive: true }}
                            style={{ width: "100%", height: 350 }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {dynamicTab === "custom" && (
                <div className="fade-in" style={{ marginBottom: 20 }}>
                  {/* Control Panel */}
                  <div className="sandbox-panel" style={{ 
                    position: "relative",
                    zIndex: 100,
                    background: "rgba(25,27,32,0.65)", 
                    backdropFilter: "blur(20px)", 
                    border: "1px solid rgba(67,179,174,0.18)", 
                    borderRadius: 20, 
                    padding: 24, 
                    marginBottom: 24,
                    boxShadow: "0 15px 45px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                  }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                      <Activity size={18} color="#43B3AE" /> Dynamic Multi-Axis Plotter & Sandbox
                    </h3>
                    
                    {/* Axis Selectors Row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#A0A0AB", fontWeight: 700, marginBottom: 8, display: "block" }}>X Axis</label>
                        <select
                          value={xAxis}
                          onChange={(e) => setXAxis(e.target.value)}
                          style={{ width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none" }}
                        >
                          {getNumericColumns().map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#43B3AE", fontWeight: 700, marginBottom: 8, display: "block" }}>Primary Y Axis</label>
                        <StreamlitMultiSelect
                          value={leftYAxis}
                          onChange={setLeftYAxis}
                          options={getNumericColumns()}
                          placeholder="Select columns"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#FF6080", fontWeight: 700, marginBottom: 8, display: "block" }}>Secondary Y Axis</label>
                        <StreamlitMultiSelect
                          value={rightYAxis}
                          onChange={setRightYAxis}
                          options={getNumericColumns()}
                          placeholder="Select columns"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#ab63fa", fontWeight: 700, marginBottom: 8, display: "block" }}>Z Axis (for 3D)</label>
                        <select
                          value={zAxis}
                          onChange={(e) => {
                            setZAxis(e.target.value);
                            if (e.target.value !== "None") setPlotterMode("3d");
                            else setPlotterMode("2d");
                          }}
                          style={{ width: "100%", padding: "10px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", fontSize: 13, outline: "none" }}
                        >
                          <option value="None">None (2D)</option>
                          {getNumericColumns().map(col => <option key={col} value={col}>{col}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <button
                        onClick={() => setShowAxisSettings(!showAxisSettings)}
                        style={{ background: "transparent", border: "none", color: "#A0A0AB", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: 0 }}
                      >
                        <ChevronRight size={14} style={{ transform: showAxisSettings ? "rotate(90deg)" : "rotate(0)", transition: "0.2s" }} />
                        Custom Axis Scaling (Min / Max Limits)
                      </button>
                      
                      {showAxisSettings && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 12 }}>
                          <div>
                            <label style={{ fontSize: 10, color: "#666" }}>X Min</label>
                            <input type="number" value={axisSettings.xMin} onChange={(e) => setAxisSettings({...axisSettings, xMin: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#666" }}>X Max</label>
                            <input type="number" value={axisSettings.xMax} onChange={(e) => setAxisSettings({...axisSettings, xMax: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#43B3AE" }}>Y Min</label>
                            <input type="number" value={axisSettings.yMin} onChange={(e) => setAxisSettings({...axisSettings, yMin: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#43B3AE" }}>Y Max</label>
                            <input type="number" value={axisSettings.yMax} onChange={(e) => setAxisSettings({...axisSettings, yMax: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#FF6080" }}>Y2 Min</label>
                            <input type="number" value={axisSettings.y2Min} onChange={(e) => setAxisSettings({...axisSettings, y2Min: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#FF6080" }}>Y2 Max</label>
                            <input type="number" value={axisSettings.y2Max} onChange={(e) => setAxisSettings({...axisSettings, y2Max: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#ab63fa" }}>Z Min</label>
                            <input type="number" value={axisSettings.zMin} onChange={(e) => setAxisSettings({...axisSettings, zMin: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#ab63fa" }}>Z Max</label>
                            <input type="number" value={axisSettings.zMax} onChange={(e) => setAxisSettings({...axisSettings, zMax: e.target.value})} style={{ width: "100%", padding: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Plot Area */}
                  <div className="sandbox-panel" style={{ 
                    background: "rgba(25,27,32,0.65)", 
                    backdropFilter: "blur(20px)", 
                    border: "1px solid rgba(67,179,174,0.18)", 
                    borderRadius: 20, 
                    padding: 24, 
                    marginBottom: 20,
                    boxShadow: "0 15px 45px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                  }}>
                    {plotterMode === "3d" ? (
                      <Plot
                        data={leftYAxis.flatMap((col, i) => {
                          const xData = getFilteredTimeData(xAxis);
                          const yData = getFilteredTimeData(col);
                          const zData = getFilteredTimeData(zAxis);
                          if (!xData || !yData || !zData) return [];
                          return [{
                            x: xData, y: yData, z: zData,
                            type: "scatter3d",
                            mode: "markers",
                            name: col,
                            marker: { size: 4, color: ["#43B3AE", "#FF6080", "#FFA15A", "#CFFF60"][i % 4], opacity: 0.8 }
                          }];
                        })}
                        layout={{
                          autosize: true, height: 700,
                          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                          font: { color: "#fff", family: "'Outfit', sans-serif" },
                          ...DARK_TOOLTIP,
                            scene: {
                              xaxis: { title: { text: xAxis, font: { color: "#fff", size: 12 } }, gridcolor: "rgba(255,255,255,0.1)", backgroundcolor: "rgba(0,0,0,0)" },
                              yaxis: { title: { text: "Y", font: { color: "#fff", size: 12 } }, gridcolor: "rgba(255,255,255,0.1)", backgroundcolor: "rgba(0,0,0,0)" },
                              zaxis: { title: { text: zAxis, font: { color: "#fff", size: 12 } }, gridcolor: "rgba(255,255,255,0.1)", backgroundcolor: "rgba(0,0,0,0)" },
                              bgcolor: "rgba(7,11,16,1)"
                            },
                            legend: { orientation: "h", y: -0.1, x: 0.5, xanchor: "center", font: { color: "#fff" } },
                            margin: { b: 80 }
                          }}
                        config={{ displayModeBar: true, responsive: true }}
                        style={{ width: "100%", height: 700 }}
                      />
                    ) : (
                      <Plot
                        data={[
                          ...leftYAxis.map((col, i) => ({
                            x: getFilteredTimeData(xAxis),
                            y: getFilteredTimeData(col),
                            type: "scatter",
                            mode: "lines",
                            name: col,
                            line: { color: ["#43B3AE", "#00CC96", "#1f77b4", "#ffa500"][i % 4], width: 3.0 },
                            yaxis: "y"
                          })),
                          ...rightYAxis.map((col, i) => ({
                            x: getFilteredTimeData(xAxis),
                            y: getFilteredTimeData(col),
                            type: "scatter",
                            mode: "lines",
                            name: col,
                            line: { color: ["#FF6080", "#FFA15A", "#CFFF60", "#ab63fa"][i % 4], width: 3.0 },
                            yaxis: "y2"
                          }))
                        ]}
                        layout={{
                          autosize: true, height: 750,
                          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                          font: { color: "#fff", family: "'Outfit', sans-serif" },
                          ...DARK_TOOLTIP,
                          margin: { l: 70, r: 70, t: 40, b: 120 },
                          xaxis: { 
                            showgrid: true, gridcolor: "rgba(255,255,255,0.18)", 
                            showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                            zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                            title: { text: xAxis, font: { color: "#fff", weight: 800 } },
                            tickfont: { weight: 600, color: "#fff" },
                            range: [parseAxisValue(axisSettings.xMin) || null, parseAxisValue(axisSettings.xMax) || null]
                          },
                          yaxis: { 
                            showgrid: true, gridcolor: "rgba(255,255,255,0.18)",
                            showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                            zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                            title: { text: "Primary Axis", font: { color: "#43B3AE", weight: 800 } },
                            tickfont: { weight: 600, color: "#fff" },
                            side: "left",
                            range: [parseAxisValue(axisSettings.yMin) || null, parseAxisValue(axisSettings.yMax) || null]
                          },
                          yaxis2: { 
                            showgrid: false,
                            showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                            zeroline: false,
                            title: { text: "Secondary Axis", font: { color: "#FF6080", weight: 800 } },
                            tickfont: { weight: 600, color: "#fff" },
                            overlaying: "y",
                            side: "right",
                            range: [parseAxisValue(axisSettings.y2Min) || null, parseAxisValue(axisSettings.y2Max) || null]
                          },
                          legend: { 
                            orientation: "h", y: -0.15, x: 0.5, xanchor: "center", yanchor: "top",
                            font: { color: "#fff", size: 11, weight: 600 } 
                          },
                          hovermode: "x unified",
                        }}
                        config={{ displayModeBar: true, responsive: true }}
                        style={{ width: "100%", height: 750 }}
                      />
                    )}
                    <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={exportSandboxData}
                        style={{
                          padding: "10px 20px", borderRadius: 10, background: "rgba(67,179,174,0.15)",
                          border: "1px solid rgba(67,179,174,0.3)", color: "#43B3AE",
                          fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8
                        }}
                      >
                        <Download size={16} /> Export Sandbox Data (CSV)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeChannel === "analytics" && selectedRideData && !loadingData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {renderMetricCard("Total Ride Time", Math.round(((rideData?.Time?.length || 0) * 0.5) / 60), "min", 60, "safe", "#43B3AE")}
                {renderMetricCard("High Torque Demands (>50 Nm)", selectedRideData.High_Torque_Time_sec?.toFixed(1) || 0, "sec", 120, "safe", "#43B3AE")}
                {renderMetricCard("Overall Efficiency", selectedRideData.Overall_Wh_km?.toFixed(2) || 0, "Wh/km", 45, "safe", "#43B3AE")}
                {renderMetricCard("Start Pack Spread", selectedRideData.Start_Pack_Spread_C?.toFixed(1) || 0, "°C", 5, "safe", "#43B3AE")}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <div style={{ 
                  background: "rgba(25,27,32,0.65)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)", 
                  borderRadius: 20, 
                  padding: 24,
                  boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Drive Mode Distribution</h3>
                  <Plot
                    data={[{
                      values: [selectedRideData.Time_in_Comfort_min || 0, selectedRideData.Time_in_Power_min || 0, selectedRideData.Time_in_Sprint_min || 0],
                      labels: ["Comfort", "Power", "Sprint"],
                      type: "pie",
                      marker: { colors: ["#43B3AE", "#ab63fa", "#ff4b4b"] },
                      textfont: { color: "#fff" },
                      hole: 0.45,
                      textposition: "inside",
                      textinfo: "label+percent"
                    }]}
                    layout={{ 
                      autosize: true, height: 320, 
                      paper_bgcolor: "rgba(0,0,0,0)", 
                      margin: { t: 20, b: 20, l: 20, r: 20 },
                      legend: { font: { weight: 600, color: "#fff" } }
                    }}
                    config={{ displayModeBar: true, responsive: true }}
                    style={{ width: "100%", height: 320 }}
                  />
                </div>
                
                <div style={{ 
                  background: "rgba(25,27,32,0.65)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)", 
                  borderRadius: 20, 
                  padding: 24,
                  boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <Activity size={14} color="#FF6080" /> Powertrain State
                  </h3>
                  {(() => {
                    const torque = rideData["Motor_Torque [Nm]"] || [];
                    const accel = torque.filter(v => v > 2).length;
                    const coast = torque.filter(v => v >= -2 && v <= 2).length;
                    const regen = torque.filter(v => v < -2).length;
                    return (
                      <Plot
                        data={[{
                          values: [accel, coast, regen],
                          labels: ["Acceleration (> 2N)", "Coasting", "Regen Braking (< -2N)"],
                          type: "pie",
                          marker: { colors: ["#ff4b4b", "#888", "#00cc96"] },
                          textfont: { color: "#fff" },
                          hole: 0.45,
                          textposition: "inside",
                          textinfo: "percent"
                        }]}
                        layout={{ 
                          autosize: true, height: 280, 
                          paper_bgcolor: "rgba(0,0,0,0)", 
                          margin: { t: 10, b: 10, l: 10, r: 10 },
                          legend: { orientation: "v", x: 1, y: 0.5, font: { color: "#fff", size: 10 } }
                        }}
                        config={{ displayModeBar: true, responsive: true }}
                        style={{ width: "100%", height: 280 }}
                      />
                    );
                  })()}
                </div>
              </div>

              {hasColumn("Motor_Torque [Nm]") && hasColumn("Motor_Temp [C]") && (
                <div style={{ 
                  background: "rgba(25,27,32,0.65)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)", 
                  borderRadius: 20, 
                  padding: 24,
                  boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                    <AlertTriangle size={18} color="#FFA15A" /> Motor Torque vs. Thermal Deration Map
                  </h3>
                  <Plot
                    data={[
                      { 
                        x: rideData.Time, y: rideData["Motor_Torque [Nm]"], 
                        type: "scatter", mode: "lines", fill: "tozeroy", 
                        name: "Motor Torque Demanded (Nm)", 
                        line: { color: "#1f77b4", width: 0.8 }, 
                        fillcolor: "rgba(31,119,180,0.2)" 
                      },
                      { 
                        x: rideData.Time, y: rideData["Motor_Temp [C]"], 
                        type: "scatter", mode: "lines", 
                        name: "Motor Temp (C)", 
                        yaxis: "y2", 
                        line: { color: "#ff4b4b", width: 2.5 } 
                      },
                      {
                        x: [Math.min(...rideData.Time), Math.max(...rideData.Time)],
                        y: [125, 125],
                        type: "scatter", mode: "lines",
                        name: "Safety Limit (125°C)",
                        yaxis: "y2",
                        line: { color: "#FFC107", width: 2.5, dash: "dash" }
                      }
                    ]}
                    layout={{
                      autosize: true, height: 650,
                      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                      font: { color: "#fff", family: "'Outfit', sans-serif" },
                      margin: { l: 70, r: 70, t: 40, b: 120 },
                      xaxis: { 
                        showgrid: true, gridcolor: "rgba(255,255,255,0.18)", 
                        showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                        zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                        title: { text: "Time (s)", font: { color: "#fff", weight: 800 } },
                        tickfont: { weight: 600, color: "#fff" }
                      },
                      yaxis: { 
                        showgrid: true, gridcolor: "rgba(255,255,255,0.18)", 
                        showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                        zeroline: true, zerolinecolor: "rgba(255,255,255,0.25)", zerolinewidth: 1.5,
                        title: { text: "Torque (Nm)", font: { color: "#fff", weight: 800 } },
                        tickfont: { weight: 600, color: "#fff" }
                      },
                      yaxis2: { 
                        title: { text: "Temperature (°C)", font: { color: "#ff4b4b", weight: 800 } }, 
                        overlaying: "y", side: "right", showgrid: false,
                        showline: true, linecolor: "rgba(255,255,255,0.2)", linewidth: 1,
                        tickfont: { weight: 600, color: "#fff" }
                      },
                      legend: { orientation: "h", y: -0.18, x: 0.5, xanchor: "center", font: { weight: 600 } },
                      hovermode: "x unified",
                      ...DARK_TOOLTIP,
                    }}
                    config={{ displayModeBar: true, responsive: true }}
                    style={{ width: "100%", height: 650 }}
                  />
                </div>
              )}
            </>
          )}

          {activeChannel === "battery" && selectedRideData && !loadingData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {renderMetricCard("SOC Consumed", rideData?.soc ? (rideData.soc[0] - rideData.soc[rideData.soc.length - 1]).toFixed(1) : 0, "%", 100, "safe", "#ab63fa")}
                {renderMetricCard("Total Energy", selectedRideData.Total_Energy_Wh?.toFixed(0) || 0, "Wh", 5000, "safe", "#ab63fa")}
                {renderMetricCard("Avg Wh/km", selectedRideData.Overall_Wh_km?.toFixed(1) || 0, "Wh/km", 50, "safe", "#ab63fa")}
                {renderMetricCard("Pack Temperature", selectedRideData.Start_Pack_Spread_C?.toFixed(1) || 0, "°C", 10, "safe", "#ab63fa")}
              </div>

              {hasColumn("soc") && hasColumn("Front_Speed [kph]") && (
                <div style={{ 
                  background: "rgba(25,27,32,0.65)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)", 
                  borderRadius: 20, 
                  padding: 24, 
                  marginBottom: 24,
                  boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                }}>
                   <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                    <Battery size={18} color="#ab63fa" /> SOC Drop vs. Speed Profile
                  </h3>
                  <Plot
                    data={[
                      { x: rideData.Time, y: rideData["Front_Speed [kph]"], type: "scatter", mode: "lines", name: "Speed (kph)", line: { color: "#43B3AE", width: 1 }, opacity: 0.4 },
                      { x: rideData.Time, y: rideData.soc, type: "scatter", mode: "lines", name: "SOC (%)", yaxis: "y2", line: { color: "#ab63fa", width: 2.5 } }
                    ]}
                    layout={{
                      autosize: true, height: 450,
                      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                      font: { color: "#fff", family: "'Outfit', sans-serif" },
                      margin: { l: 70, r: 70, t: 30, b: 80 },
                      xaxis: { 
                        showgrid: true, gridcolor: "rgba(255,255,255,0.18)", 
                        showline: true, linecolor: "rgba(255,255,255,0.2)",
                        title: { text: "Time (s)", font: { weight: 800 } },
                        tickfont: { weight: 600, color: "#fff" } 
                      },
                      yaxis: { 
                        showgrid: true, gridcolor: "rgba(255,255,255,0.18)", 
                        title: { text: "Speed (kph)", font: { weight: 800 } },
                        tickfont: { weight: 600, color: "#fff" } 
                      },
                      yaxis2: { 
                        title: { text: "SOC (%)", font: { weight: 800, color: "#ab63fa" } }, 
                        overlaying: "y", side: "right", showgrid: false,
                        tickfont: { weight: 600, color: "#fff" } 
                      },
                      showlegend: true,
                      legend: { orientation: "h", y: -0.2, x: 0.5, xanchor: "center", font: { weight: 600 } },
                      hovermode: "x unified",
                      ...DARK_TOOLTIP,
                    }}
                    config={{ displayModeBar: true }}
                    style={{ width: "100%", height: 450 }}
                  />
                </div>
              )}

              {hasColumn("Motor_Temp [C]") && hasColumn("Instant_Power [W]") && (
                <div style={{ 
                  background: "rgba(25,27,32,0.65)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)", 
                  borderRadius: 20, 
                  padding: 24,
                  boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                }}>
                   <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                    <Thermometer size={18} color="#FFD700" /> Thermal-Efficiency Correlation
                  </h3>
                   {(() => {
                    const temp = rideData["Motor_Temp [C]"] || [];
                    const power = rideData["Instant_Power [W]"] || [];
                    const speed = rideData["Front_Speed [kph]"] || [];
                    
                    const brackets = { optimal: [], soaking: [], critical: [] };
                    temp.forEach((t, i) => {
                      if (speed[i] < 5 || power[i] <= 0) return;
                      const wh_km = (power[i] / speed[i]);
                      if (t < 90) brackets.optimal.push(wh_km);
                      else if (t <= 110) brackets.soaking.push(wh_km);
                      else brackets.critical.push(wh_km);
                    });

                    const getAvg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
                    
                    return (
                      <Plot
                        data={[{
                          x: ["< 90°C (Optimal)", "90-110°C (Soaking)", "> 110°C (Critical)"],
                          y: [getAvg(brackets.optimal), getAvg(brackets.soaking), getAvg(brackets.critical)],
                          type: "bar",
                          marker: { color: ["#00CC96", "#FFD700", "#FF4B4B"] },
                          textfont: { weight: 700 }
                        }]}
                        layout={{
                          autosize: true, height: 400,
                          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
                          font: { color: "#fff", family: "'Outfit', sans-serif" },
                          margin: { l: 60, r: 20, t: 20, b: 60 },
                          xaxis: { showgrid: false, tickfont: { weight: 700 } },
                          yaxis: { 
                            title: { text: "Efficiency (Wh/km)", font: { weight: 800 } },
                            showgrid: true, gridcolor: "rgba(255,255,255,0.12)",
                            tickfont: { weight: 600 }
                          }
                        }}
                        config={{ displayModeBar: true }}
                        style={{ width: "100%", height: 400 }}
                      />
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {activeChannel === "driver" && selectedRideData && !loadingData && (
            <div className="fade-in">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <div style={{ 
                  background: "rgba(25,27,32,0.65)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)", 
                  borderRadius: 20, 
                  padding: 24, 
                  textAlign: "center",
                  boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                }}>
                   <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 20 }}>Predicted Aggression Indice</h3>
                   <Plot
                    data={[{
                      type: "indicator",
                      mode: "gauge+number",
                      value: selectedRideData.Drive_Score || 0,
                      number: { font: { color: "#fff", size: 40, weight: 800 } },
                      gauge: {
                        axis: { range: [0, 100], tickwidth: 1, tickcolor: "#fff" },
                        bar: { color: "rgba(255,255,255,0.1)" },
                        bgcolor: "rgba(0,0,0,0.2)",
                        steps: [
                          { range: [0, 30], color: "#00CC96" },
                          { range: [30, 60], color: "#FFD700" },
                          { range: [60, 100], color: "#FF4B4B" }
                        ],
                        threshold: {
                          line: { color: "#fff", width: 4 },
                          thickness: 0.75,
                          value: selectedRideData.Drive_Score || 0
                        }
                      }
                    }]}
                    layout={{ 
                      autosize: true, height: 320, 
                      paper_bgcolor: "rgba(0,0,0,0)", 
                      margin: { t: 30, b: 30, l: 30, r: 30 } 
                    }}
                    config={{ displayModeBar: true }}
                    style={{ width: "100%", height: 320 }}
                  />
                  <div style={{ color: "#888", fontSize: 13, fontWeight: 600, marginTop: 12 }}>ML Inference: RandomForest Classifier</div>
                </div>

                <div style={{ 
                  background: "rgba(25,27,32,0.65)", 
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.08)", 
                  borderRadius: 20, 
                  padding: 24,
                  boxShadow: "0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)"
                }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 20 }}>Ride Feature Vector DNA</h3>
                  <Plot
                    data={[{
                      type: "scatterpolar",
                      r: [
                        Math.min(((selectedRideData.Avg_Torque_Nm || 0) / 40) * 100, 100),
                        Math.min(((selectedRideData.Accel_Freq || 0) / 15) * 100, 100),
                        selectedRideData.Pct_Sprint || 0,
                        Math.min(((selectedRideData.Overall_Wh_km || 0) / 50) * 100, 100),
                        Math.min(((selectedRideData.Speed_Osc_Index || 0) / 3) * 100, 100)
                      ],
                      theta: ['Torque Usage', 'Accel Freq', 'Sprint %', 'Energy Index', 'Oscillation'],
                      fill: 'toself',
                      name: 'Ride Feature Vector',
                      fillcolor: selectedRideData.Drive_Score > 60 ? "rgba(255,75,75,0.5)" : "rgba(67,179,174,0.5)",
                      line: { color: selectedRideData.Drive_Score > 60 ? "#FF4B4B" : "#43B3AE", width: 2 }
                    }]}
                    layout={{
                      autosize: true, height: 320,
                      paper_bgcolor: "rgba(0,0,0,0)",
                      polar: {
                        bgcolor: "rgba(0,0,0,0.2)",
                        radialaxis: { visible: true, range: [0, 100], tickfont: { size: 10, color: "#888" }, gridcolor: "rgba(255,255,255,0.1)" },
                        angularaxis: { tickfont: { size: 11, color: "#fff", weight: 600 }, gridcolor: "rgba(255,255,255,0.1)" }
                      },
                      margin: { t: 40, b: 40, l: 60, r: 60 }
                    }}
                    config={{ displayModeBar: true }}
                    style={{ width: "100%", height: 320 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
                {[
                  { label: "Avg Torque", val: `${selectedRideData.Avg_Torque_Nm || 0} Nm`, icon: <Activity size={12} /> },
                  { label: "Torque Bursts", val: selectedRideData.Peak_Torque_Bursts || 0, icon: <Zap size={12} /> },
                  { label: "Accel Freq", val: selectedRideData.Accel_Freq?.toFixed(1) || 0, icon: <TrendingUp size={12} /> },
                  { label: "Oscillation", val: selectedRideData.Speed_Osc_Index?.toFixed(2) || 0, icon: <Repeat size={12} /> },
                  { label: "Sprint %", val: `${selectedRideData.Pct_Sprint?.toFixed(1) || 0} %`, icon: <Zap size={12} /> }
                ].map((item, i) => (
                  <div key={i} style={{ 
                    background: "rgba(255,255,255,0.03)", 
                    border: "1px solid rgba(255,255,255,0.08)", 
                    borderRadius: 16, 
                    padding: 20, 
                    textAlign: "center",
                    boxShadow: "0 10px 20px rgba(0,0,0,0.2)"
                  }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      {item.icon} {item.label}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeChannel === "events" && (
            <div style={{ 
              background: "rgba(25,27,32,0.65)", 
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)", 
              borderRadius: 24, 
              padding: 80, 
              textAlign: "center",
              boxShadow: "0 20px 50px rgba(0,0,0,0.4)"
            }}>
              <div style={{ 
                width: 120, height: 120, borderRadius: "50%", background: "rgba(255,161,90,0.1)", 
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px",
                border: "1px solid rgba(255,161,90,0.2)",
                boxShadow: "0 0 30px rgba(255,161,90,0.1)"
              }}>
                <AlertTriangle size={48} color="#FFA15A" />
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 16 }}>Automated Event Detection</h2>
              <p style={{ fontSize: 16, color: "#A0A0AB", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                Our ML models are scanning the telemetry for thermal derations, torque bursts, and anomalous patterns. Results will appear here once processed.
              </p>
              <div style={{ marginTop: 40, display: "flex", justifyContent: "center", gap: 16 }}>
                 <div style={{ padding: "12px 24px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "#666" }}>
                    Status: <span style={{ color: "#43B3AE", fontWeight: 700 }}>Active Monitor</span>
                 </div>
              </div>
            </div>
          )}

          {activeChannel === "repository" && (
            <div style={{ 
              background: "rgba(25,27,32,0.65)", 
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)", 
              borderRadius: 24, 
              padding: 40,
              boxShadow: "0 20px 50px rgba(0,0,0,0.4)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
                <div style={{ 
                  width: 60, height: 60, borderRadius: 16, background: "rgba(239,85,59,0.1)", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(239,85,59,0.2)"
                }}>
                  <FolderOpen size={30} color="#EF553B" />
                </div>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>Master Test Repository</h2>
                  <p style={{ fontSize: 14, color: "#A0A0AB" }}>{rides.length} rides indexed and available for deep analysis</p>
                </div>
              </div>
              
              {rides.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                  {rides.slice(0, 10).map((ride, i) => (
                    <div key={i} style={{ 
                      padding: "16px 24px", 
                      background: "rgba(255,255,255,0.02)", 
                      border: "1px solid rgba(255,255,255,0.05)", 
                      borderRadius: 16, 
                      display: "flex", 
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                      hover: { background: "rgba(255,255,255,0.05)" }
                    }} className="repo-item">
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#666" }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: 15, color: "#fff", fontWeight: 700 }}>{ride.Ride_Name}</div>
                          <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{ride.Rider || "System Test"} | {ride.Total_Distance_km?.toFixed(1) || 0} km | {new Date().toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, textTransform: "uppercase", color: "#666", fontWeight: 700, marginBottom: 4 }}>Drive Score</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: (ride.Drive_Score || 0) > 60 ? "#FF6080" : "#43B3AE" }}>{ride.Drive_Score || 0}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .fade-in {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sandbox-panel:hover {
          border-color: rgba(67,179,174,0.4) !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08) !important;
          transition: all 0.4s ease;
        }
      `}</style>
    </div>
  );
}
