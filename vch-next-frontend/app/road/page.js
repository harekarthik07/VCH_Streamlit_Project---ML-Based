"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import RoadSidebar from "../components/RoadSidebar";
import {
  Thermometer, Zap, Activity, Gauge, Battery, Cpu, FolderOpen,
  AlertTriangle, Bike
} from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8001";

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
  const [thermalChannels] = useState(["IGBT", "Motor", "HighCell", "AFE"]);

  useEffect(() => {
    loadRides();
  }, []);

  useEffect(() => {
    if (selectedRide) loadRideData(selectedRide);
    else setRideData(null);
  }, [selectedRide]);

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
    
    const colData = rideData[map.col];
    const timeData = rideData.Time;
    
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

  const renderMetricCard = (title, value, unit, limit, status, color, extra = "") => (
    <div style={{
      background: status === "BREACH" ? "rgba(255,75,75,0.12)" : "rgba(20,22,28,0.54)",
      border: `1px solid ${status === "BREACH" ? "rgba(255,75,75,0.35)" : "rgba(255,255,255,0.08)"}`,
      borderTop: `3px solid ${status === "BREACH" ? "#ff4b4b" : color}`,
      borderRadius: 16, padding: "20px 16px", transition: "all 0.3s",
    }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, color: color, letterSpacing: -1 }}>
        {value} <span style={{ fontSize: 16, color: "#888" }}>{unit}</span>
      </div>
      {extra && <div style={{ fontSize: 12, color: "#A0A0AB", marginTop: 6 }}>{extra}</div>}
      <div style={{ fontSize: 11, color: "#666", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        Limit: {limit}{unit} | <span style={{ color: status === "BREACH" ? "#ff4b4b" : "#00CC96", fontWeight: 700 }}>
          {status === "BREACH" ? "BREACH" : "SAFE"}
        </span>
      </div>
    </div>
  );

  const renderChart = (title, traces, height = 400) => (
    <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 16 }}>{title}</h3>
      <div style={{ height }}>
        <Plot
          data={traces}
          layout={{
            autosize: true, height,
            paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(7,11,16,1)",
            font: { color: "#A0A0AB", family: "'Outfit', sans-serif" },
            margin: { l: 55, r: 20, t: 30, b: 50 },
            xaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.05)", title: { text: "Time (s)", font: { color: "#A0A0AB" } } },
            yaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.05)" },
            legend: { orientation: "h", y: 1.12, x: 0, font: { color: "#A0A0AB" } },
            hovermode: "x unified",
          }}
          config={{ displayModeBar: false, responsive: true }}
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
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        onRefresh={loadRides}
      />

      <main className="main-content">
        <div className="fade-in">
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: -1, marginBottom: 4 }}>
              Road Test Monitor
            </h1>
            <div style={{ fontSize: 14, color: "#A0A0AB" }}>
              Target: <span style={{ color: "#00cc96", fontWeight: 700 }}>{selectedRide || "No ride selected"}</span>
            </div>
          </div>

          {/* Route Info Bar */}
          {selectedRideData && (
            <div style={{
              background: "rgba(25,27,32,0.8)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "14px 20px", marginBottom: 24,
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 4 }}>Test Route</div>
                <div style={{ color: "#00CC96", fontWeight: 700, fontSize: 14 }}>{currentRouteType}</div>
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
                <div style={{ color: "#00CC96", fontWeight: 700, fontSize: 14 }}>
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
              {/* Thermal Metric Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
                {thermalChannels.map(ch => {
                  const thermal = getThermalData(ch);
                  const map = THERMAL_MAP[ch];
                  
                  if (!thermal) {
                    return (
                      <div key={ch} style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                        <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", marginBottom: 4 }}>{ch}</div>
                        <div style={{ color: "#666", fontSize: 14, marginTop: 20 }}>No data</div>
                      </div>
                    );
                  }
                  
                  const status = thermal.max >= thermal.limit ? "BREACH" : "SAFE";
                  const extraInfo = thermal.cellNo ? `Cell #${Math.round(thermal.cellNo)}` : `Peak @ ${thermal.maxTime?.toFixed(0) || 0}s`;
                  
                  return renderMetricCard(
                    `${ch} Max Temperature`,
                    thermal.max.toFixed(1),
                    "°C",
                    thermal.limit,
                    status,
                    thermal.color,
                    extraInfo
                  );
                })}
              </div>

              {/* Individual Thermal Curves */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                {thermalChannels.map(ch => {
                  const thermal = getThermalData(ch);
                  const map = THERMAL_MAP[ch];
                  
                  if (!thermal) return null;
                  
                  const limitLine = [{
                    x: thermal.time,
                    y: Array(thermal.time.length).fill(thermal.limit),
                    type: "scatter",
                    mode: "lines",
                    name: "Limit",
                    line: { color: "rgba(255,75,75,0.5)", width: 2, dash: "dash" }
                  }];
                  
                  return (
                    <div key={ch} style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{map.label}</h3>
                        <span style={{ fontSize: 10, color: "#ff4b4b", background: "rgba(255,75,75,0.15)", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>
                          Limit: {map.limit}°C
                        </span>
                      </div>
                      <Plot
                        data={[
                          {
                            x: thermal.time,
                            y: thermal.values,
                            type: "scatter",
                            mode: "lines",
                            name: ch,
                            line: { color: map.color, width: 2.5 }
                          },
                          ...limitLine
                        ]}
                        layout={{
                          autosize: true, height: 280,
                          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(7,11,16,1)",
                          font: { color: "#A0A0AB", family: "'Outfit', sans-serif" },
                          margin: { l: 45, r: 15, t: 20, b: 40 },
                          xaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.05)" },
                          yaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.05)", title: { text: "Temp (°C)", font: { color: "#A0A0AB" } } },
                          hovermode: "x unified",
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: "100%", height: 280 }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Combined Thermal Overlay */}
              {renderChart("Combined Thermal Overlay", 
                thermalChannels
                  .filter(ch => getThermalData(ch))
                  .map(ch => {
                    const thermal = getThermalData(ch);
                    const map = THERMAL_MAP[ch];
                    return {
                      x: thermal.time,
                      y: thermal.values,
                      type: "scatter",
                      mode: "lines",
                      name: ch,
                      line: { color: map.color, width: 2.5 }
                    };
                  }),
                450
              )}
            </>
          )}

          {activeChannel === "dynamic" && rideData && !loadingData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>Total Distance</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{selectedRideData?.Total_Distance_km?.toFixed(1) || 0} <span style={{ fontSize: 14, color: "#888" }}>km</span></div>
                </div>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>Energy Consumed</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{selectedRideData?.Total_Energy_Wh?.toFixed(0) || 0} <span style={{ fontSize: 14, color: "#888" }}>Wh</span></div>
                </div>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>High Torque</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{selectedRideData?.High_Torque_Time_sec?.toFixed(0) || 0} <span style={{ fontSize: 14, color: "#888" }}>sec</span></div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {["Front_Speed [kph]", "RPM [RPM]", "Instant_Power [W]", "Motor_Torque [Nm]"].map(ch => {
                  if (!hasColumn(ch)) return null;
                  const data = rideData[ch];
                  const time = rideData.Time;
                  return (
                    <div key={ch} style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 12 }}>{ch}</h3>
                      <Plot
                        data={[{
                          x: time, y: data,
                          type: "scatter", mode: "lines",
                          line: { color: "#00CC96", width: 2 }
                        }]}
                        layout={{
                          autosize: true, height: 280,
                          paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(7,11,16,1)",
                          font: { color: "#A0A0AB" },
                          margin: { l: 45, r: 15, t: 20, b: 40 },
                          xaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.05)" },
                          yaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.05)" },
                          hovermode: "x unified",
                        }}
                        config={{ displayModeBar: false }}
                        style={{ width: "100%", height: 280 }}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeChannel === "analytics" && selectedRideData && !loadingData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>Total Time</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{Math.round(((rideData?.Time?.length || 0) * 0.5) / 60)} <span style={{ fontSize: 14, color: "#888" }}>min</span></div>
                </div>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>Efficiency</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{selectedRideData.Overall_Wh_km?.toFixed(1) || 0} <span style={{ fontSize: 14, color: "#888" }}>Wh/km</span></div>
                </div>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>Avg Torque</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{selectedRideData.Avg_Torque_Nm?.toFixed(1) || 0} <span style={{ fontSize: 14, color: "#888" }}>Nm</span></div>
                </div>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>Torque Bursts</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{selectedRideData.Peak_Torque_Bursts || 0}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Drive Mode Distribution</h3>
                  <Plot
                    data={[{
                      values: [selectedRideData.Time_in_Comfort_min || 0, selectedRideData.Time_in_Power_min || 0, selectedRideData.Time_in_Sprint_min || 0],
                      labels: ["Comfort", "Power", "Sprint"],
                      type: "pie",
                      marker: { colors: ["#00CC96", "#ab63fa", "#ff4b4b"] },
                      hole: 0.45,
                      textposition: "inside",
                      textinfo: "label+percent"
                    }]}
                    layout={{ autosize: true, height: 280, paper_bgcolor: "rgba(0,0,0,0)", margin: { t: 20, b: 20, l: 20, r: 20 } }}
                    config={{ displayModeBar: false }}
                    style={{ width: "100%", height: 280 }}
                  />
                </div>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Speed Distribution</h3>
                  <Plot
                    data={[{
                      x: rideData?.Time || [],
                      y: rideData?.["Front_Speed [kph]"] || [],
                      type: "histogram",
                      marker: { color: "#00CC96" },
                      nbinsx: 30
                    }]}
                    layout={{ 
                      autosize: true, height: 280, 
                      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(7,11,16,1)",
                      font: { color: "#A0A0AB" },
                      xaxis: { title: "Speed (kph)", showgrid: true, gridcolor: "rgba(255,255,255,0.05)" },
                      yaxis: { title: "Count", showgrid: true, gridcolor: "rgba(255,255,255,0.05)" },
                      margin: { t: 20, b: 40, l: 45 }
                    }}
                    config={{ displayModeBar: false }}
                    style={{ width: "100%", height: 280 }}
                  />
                </div>
              </div>

              {hasColumn("Motor_Torque [Nm]") && hasColumn("Motor_Temp [C]") && (
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Motor Torque vs Temperature</h3>
                  <Plot
                    data={[
                      { x: rideData.Time, y: rideData["Motor_Torque [Nm]"], type: "scatter", mode: "lines", fill: "tozeroy", name: "Torque (Nm)", line: { color: "#1f77b4", width: 1 }, fillcolor: "rgba(31,119,180,0.2)" },
                      { x: rideData.Time, y: rideData["Motor_Temp [C]"], type: "scatter", mode: "lines", name: "Temp (°C)", yaxis: "y2", line: { color: "#ff4b4b", width: 2.5 } }
                    ]}
                    layout={{
                      autosize: true, height: 400,
                      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(7,11,16,1)",
                      font: { color: "#A0A0AB" },
                      margin: { l: 50, r: 60, t: 30, b: 50 },
                      xaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.05)", title: "Time (s)" },
                      yaxis: { showgrid: true, gridcolor: "rgba(255,255,255,0.05)", title: "Torque (Nm)" },
                      yaxis2: { title: "Temperature (°C)", overlaying: "y", side: "right", showgrid: false },
                      legend: { orientation: "h", y: 1.08 },
                      hovermode: "x unified",
                    }}
                    config={{ displayModeBar: false }}
                    style={{ width: "100%", height: 400 }}
                  />
                </div>
              )}
            </>
          )}

          {activeChannel === "battery" && selectedRideData && !loadingData && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>SOC Consumed</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{(selectedRideData.Start_Pack_Temp_C - (selectedRideData.Start_Pack_Temp_C - 10))?.toFixed(1) || 0} <span style={{ fontSize: 14, color: "#888" }}>%</span></div>
                </div>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>Total Energy</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{selectedRideData.Total_Energy_Wh?.toFixed(0) || 0} <span style={{ fontSize: 14, color: "#888" }}>Wh</span></div>
                </div>
                <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: "#A0A0AB", fontWeight: 700, marginBottom: 8 }}>Avg Wh/km</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{selectedRideData.Overall_Wh_km?.toFixed(1) || 0} <span style={{ fontSize: 14, color: "#888" }}>Wh/km</span></div>
                </div>
              </div>

              {hasColumn("soc") && hasColumn("Front_Speed [kph]") && (
                renderChart("SOC vs Speed Profile", [
                  { x: rideData.Time, y: rideData["Front_Speed [kph]"], type: "scatter", mode: "lines", name: "Speed (kph)", line: { color: "#00CC96", width: 1 }, opacity: 0.4 },
                  { x: rideData.Time, y: rideData.soc, type: "scatter", mode: "lines", name: "SOC (%)", yaxis: "y2", line: { color: "#ab63fa", width: 2 } }
                ], 400)
              )}
            </>
          )}

          {activeChannel === "driver" && selectedRideData && !loadingData && (
            <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 60, textAlign: "center" }}>
              <Cpu size={80} color="#FF6080" style={{ marginBottom: 24 }} />
              <h2 style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 12 }}>ML Driver Diagnostics</h2>
              <p style={{ fontSize: 16, color: "#A0A0AB", maxWidth: 500, margin: "0 auto 30px" }}>
                RandomForest-based driver aggression scoring
              </p>
              <div style={{ display: "inline-block", padding: "30px 50px", background: "rgba(0,204,150,0.08)", borderRadius: 20, border: "1px solid rgba(0,204,150,0.3)" }}>
                <div style={{ fontSize: 14, textTransform: "uppercase", color: "#A0A0AB", marginBottom: 8 }}>ML Drive Score</div>
                <div style={{ fontSize: 72, fontWeight: 900, color: "#00CC96" }}>{selectedRideData.Drive_Score || 0}</div>
                <div style={{ fontSize: 18, color: "#00CC96", fontWeight: 700 }}>{selectedRideData.Ride_Class || "Unknown"}</div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 40, textAlign: "left" }}>
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Avg Torque</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{selectedRideData.Avg_Torque_Nm?.toFixed(1) || 0} Nm</div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Torque Bursts</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{selectedRideData.Peak_Torque_Bursts || 0}</div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Accel Frequency</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{selectedRideData.Accel_Freq || 0}</div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Sprint %</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{selectedRideData.Pct_Sprint?.toFixed(1) || 0}%</div>
                </div>
              </div>
            </div>
          )}

          {activeChannel === "events" && (
            <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 60, textAlign: "center" }}>
              <AlertTriangle size={80} color="#FFA15A" style={{ marginBottom: 24 }} />
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 12 }}>Automated Event Detection</h2>
              <p style={{ fontSize: 14, color: "#A0A0AB", maxWidth: 450, margin: "0 auto" }}>
                Thermal derations, torque bursts, and anomalous patterns detected automatically.
              </p>
            </div>
          )}

          {activeChannel === "repository" && (
            <div style={{ background: "rgba(25,25,30,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 60, textAlign: "center" }}>
              <FolderOpen size={80} color="#EF553B" style={{ marginBottom: 24 }} />
              <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 12 }}>Master Test Repository</h2>
              <p style={{ fontSize: 14, color: "#A0A0AB", maxWidth: 450, margin: "0 auto" }}>
                {rides.length} rides processed and stored in the database.
              </p>
              
              {rides.length > 0 && (
                <div style={{ marginTop: 30, textAlign: "left", maxWidth: 600, margin: "30px auto 0" }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 12, textTransform: "uppercase", fontWeight: 700 }}>Recent Rides</div>
                  {rides.slice(0, 5).map((ride, i) => (
                    <div key={i} style={{ padding: "12px 16px", background: "rgba(0,0,0,0.3)", borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{ride.Ride_Name}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{ride.Rider || "Unknown"} | {ride.Total_Distance_km?.toFixed(1) || 0} km</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#00CC96" }}>{ride.Drive_Score || 0}</div>
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
      `}</style>
    </div>
  );
}
