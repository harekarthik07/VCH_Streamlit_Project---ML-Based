"use client";
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import Image from "next/image";
import DynoSidebar from "../components/DynoSidebar";
import StreamlitSelect from "../components/StreamlitSelect";
import StreamlitMultiSelect from "../components/StreamlitMultiSelect";
import { Download, Zap, TrendingUp, Box, BatteryCharging, HeartPulse, ClipboardList, Gauge, Bike, ChevronLeft, Activity, Info, XCircle, UploadCloud, File, Trash2, Terminal, Lock, Star } from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8001";

const LIMIT_MAP = { IGBT: 95, Motor: 125, HighCell: 50, AFE: 50 };
// AFE uses 'AFE_dTdt_Max' / 'AFE_dT_Max' in the processed data, not 'AFE_dTdt' / 'AFE_dT'
const COL_MAP = { IGBT: { dTdt: "IGBT_dTdt", dT: "IGBT_dT" }, Motor: { dTdt: "Motor_dTdt", dT: "Motor_dT" }, HighCell: { dTdt: "HighCell_dTdt", dT: "HighCell_dT" }, AFE: { dTdt: "AFE_dTdt_Max", dT: "AFE_dT_Max" } };
const CARD_ACCENTS = { 
  IGBT: "#43B3AE", 
  Motor: "#FFD700", 
  HighCell: "#FF4B4B", 
  AFE: "#43B3AE" 
};
const GOLDEN_BIKES = [
  "2025_10_22-07-BK",
  "2025_10_09-14-BK",
  "2025_10_25-09-BK (Nw-BB)",
  "2025_10_20-15-BK",
  "2025_10_19-17-BK",
  "2025_10_25-04-BK (Nw-BB)"
];

const DARK_TOOLTIP = {
  hoverlabel: {
    bgcolor: "rgba(30,30,35,0.95)",
    bordercolor: "rgba(255,255,255,0.1)",
    font: { family: "Calibri, Segoe UI, Arial, sans-serif", color: "#FFF", size: 12 }
  }
};

// Reusable CSV download helper
function downloadCSV(columns, data, filename) {
  const rows = [columns.join(",")];
  const rowCount = data[columns[0]]?.length || 0;
  for (let i = 0; i < rowCount; i++) {
    rows.push(columns.map(col => {
      const v = data[col]?.[i];
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function downloadTableCSV(headers, rows, filename) {
  const csv = [headers.join(","), ...rows.map(r => r.map(v => { const s = String(v ?? ""); return s.includes(",") ? `"${s}"` : s; }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { id: "rise_rate", label: "Rise Rate (dT/dt)", icon: <Zap size={14} color="#43B3AE"/> },
  { id: "cumulative", label: "Cumulative Rise (ΔT)", icon: <TrendingUp size={14} color="#8388B9"/> },
  { id: "3d_sandbox", label: "Dynamic 3D Plotter", icon: <Box size={14} color="#55AAFF"/> },
  { id: "power_analysis", label: "Power Analysis", icon: <BatteryCharging size={14} color="#CFFF60"/> },
  { id: "battery_health", label: "Battery Health", icon: <HeartPulse size={14} color="#FF6080"/> },
  { id: "test_repository", label: "Test Repository", icon: <ClipboardList size={14} color="#FFA15A"/> },
  { id: "fleet_registry", label: "Fleet Registry", icon: <Gauge size={14} color="#EF553B"/> },
  { id: "data_engine", label: "Data Engine", icon: <UploadCloud size={14} color="#55AAFF"/> }
];

export default function DynoPage() {
  const [summaries, setSummaries] = useState([]);
  const [selectedTest, setSelectedTest] = useState("");
  const [compareTests, setCompareTests] = useState([]);
  const [telemetry, setTelemetry] = useState(null);
  const [rawTelemetry, setRawTelemetry] = useState(null);
  const [compareDataMap, setCompareDataMap] = useState({});
  const [envelopes, setEnvelopes] = useState({});
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [loadingRawTelemetry, setLoadingRawTelemetry] = useState(false);
  const [loading, setLoading] = useState(true);

  const [appMode, setAppMode] = useState("Monitor Dashboard");
  const [channels, setChannels] = useState(["IGBT", "Motor", "HighCell", "AFE"]);
  const [envelopeMode, setEnvelopeMode] = useState("Statistical (2-Sigma)");
  const [tolerancePct, setTolerancePct] = useState(20);
  const [snapshotDuration, setSnapshotDuration] = useState("2 min");
  const [activeTab, setActiveTab] = useState("rise_rate");

  const [sandboxX, setSandboxX] = useState("Time (s)");
  const [sandboxY1, setSandboxY1] = useState(["Motor_Temp (oC)"]);
  const [sandboxY2, setSandboxY2] = useState([]);
  const [sandboxZ, setSandboxZ] = useState("None");

  const [batteryData, setBatteryData] = useState(null);
  const [loadingBattery, setLoadingBattery] = useState(false);

  const [qcTimeS, setQcTimeS] = useState(120);
  const [qcEnvMethod, setQcEnvMethod] = useState("Tolerance (%)");
  const [qcTolerance, setQcTolerance] = useState(20);
  const [qcTarget, setQcTarget] = useState(["All Data"]);
  const [qcMetric, setQcMetric] = useState(["All Assessments"]);
  const [repoSearch, setRepoSearch] = useState("");

  const [fleetData, setFleetData] = useState({});
  const [selectedBike, setSelectedBike] = useState(null);
  const [searchBikes, setSearchBikes] = useState(["All Vehicles"]);
  const [historicalTest, setHistoricalTest] = useState("");
  const [historicalTelemetry, setHistoricalTelemetry] = useState(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);

  // Data Engine state
  const GOLDEN_BIKES_STR = "2025_10_22-07-BK, 2025_10_09-14-BK, 2025_10_25-09-BK (Nw-BB), 2025_10_20-15-BK, 2025_10_19-17-BK, 2025_10_25-04-BK (Nw-BB)";
  const [deUploadMode, setDeUploadMode] = useState("Evaluation (Test)");
  const [deIsHovering, setDeIsHovering] = useState(false);
  const [deFiles, setDeFiles] = useState([]);
  const [deLogs, setDeLogs] = useState("");
  const [deIsProcessing, setDeIsProcessing] = useState(false);
  const [dePassword, setDePassword] = useState("");
  const [deDevUnlocked, setDeDevUnlocked] = useState(false);
  const [deProcessedTests, setDeProcessedTests] = useState([]);
  const [deDelTest, setDeDelTest] = useState("");
  const [dePromoTest, setDePromoTest] = useState("");
  const deFileInputRef = useRef(null);
  const deLogRef = useRef(null);

  // PLM Hardware Registry state
  const [plmTab, setPlmTab] = useState("bulk");
  const [plmFile, setPlmFile] = useState(null);
  const [plmIsHovering, setPlmIsHovering] = useState(false);
  const [plmStatus, setPlmStatus] = useState(null); // {ok, msg}
  const [plmUploading, setPlmUploading] = useState(false);
  const plmFileInputRef = useRef(null);
  // Manual entry state
  const [plmBikeNo, setPlmBikeNo] = useState(19);
  const [plmFields, setPlmFields] = useState({ vin:"", battery_box_id:"", motor_id:"", aux_battery_id:"", left_module_id:"", right_module_id:"", bms_id:"", status:"Offline" });
  const [plmSaving, setPlmSaving] = useState(false);

  // When bike number changes, pre-fill from fleet data
  useEffect(() => {
    const key = `BIKE-${plmBikeNo}`;
    const existing = fleetData[key] || {};
    setPlmFields({
      vin:             existing.vin             || "",
      battery_box_id:  existing.battery_box_id  || "",
      motor_id:        existing.motor_id        || "",
      aux_battery_id:  existing.aux_battery_id  || "",
      left_module_id:  existing.left_module_id  || "",
      right_module_id: existing.right_module_id || "",
      bms_id:          existing.bms_id          || "",
      status:          existing.status          || "Offline",
    });
  }, [plmBikeNo, fleetData]);

  const plmHandleFileDrop = (files) => {
    if (files && files[0]) setPlmFile(files[0]);
  };

  const plmUploadManifest = async () => {
    if (!plmFile) return;
    setPlmUploading(true); setPlmStatus(null);
    try {
      const fd = new FormData(); fd.append("file", plmFile);
      const res = await axios.post(`${API}/api/bike/upload_manifest`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPlmStatus({ ok: true, msg: res.data.message });
      setPlmFile(null);
      const fr = await axios.get(`${API}/api/fleet`);
      setFleetData(fr.data || {});
    } catch (e) {
      setPlmStatus({ ok: false, msg: e.response?.data?.detail || e.message });
    } finally { setPlmUploading(false); }
  };

  const plmSaveManual = async () => {
    setPlmSaving(true); setPlmStatus(null);
    try {
      const payload = { bike_no: plmBikeNo, ...plmFields };
      const res = await axios.post(`${API}/api/bike/manual_update`, payload);
      setPlmStatus({ ok: true, msg: `Saved ${res.data.updated_fields.length} field(s) for BIKE-${plmBikeNo}` });
      const fr = await axios.get(`${API}/api/fleet`);
      setFleetData(fr.data || {});
    } catch (e) {
      setPlmStatus({ ok: false, msg: e.response?.data?.detail || e.message });
    } finally { setPlmSaving(false); }
  };

  useEffect(() => { if (deLogRef.current) deLogRef.current.scrollTop = deLogRef.current.scrollHeight; }, [deLogs]);

  const deLoadProcessedTests = async () => {
    try {
      const res = await axios.get(`${API}/api/dyno/processed_tests`);
      const tests = Array.isArray(res.data) ? res.data : [];
      setDeProcessedTests(tests);
      if (tests.length > 0) { setDeDelTest(tests[0].Test_Name); setDePromoTest(tests[0].Test_Name); }
    } catch (e) {}
  };
  useEffect(() => { if (deDevUnlocked) deLoadProcessedTests(); }, [deDevUnlocked]);

  const deAppendLog = (msg) => setDeLogs(prev => prev + `> ${msg}\n`);

  const deUploadFiles = async () => {
    if (deFiles.length === 0) return;
    deAppendLog(`Starting upload sequence for ${deFiles.length} file(s)...`);
    for (const file of deFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", deUploadMode);
      try {
        await axios.post(`${API}/api/dyno/upload`, formData, { headers: { "Content-Type": "multipart/form-data" } });
        deAppendLog(`✅ Uploaded: ${file.name}`);
      } catch (e) { deAppendLog(`❌ Failed: ${file.name}: ${e.message}`); }
    }
    setDeFiles([]);
    deAppendLog("Upload sequence complete.");
  };

  const deRunProcessing = async () => {
    setDeIsProcessing(true);
    deAppendLog("--- Initiating Core Processing Engine ---");
    try {
      const res = await axios.post(`${API}/api/dyno/process`);
      if (res.data.logs) setDeLogs(prev => prev + res.data.logs + "\n");
      if (res.data.error) deAppendLog(`[ERROR]: ${res.data.error}`);
      else {
        deAppendLog(`✅ Processing complete. Synchronized ${res.data.result?.Processed || 0} files.`);
        // 🔄 Auto-refresh UI data after processing
        loadData();
      }
    } catch (e) { deAppendLog(`[FATAL]: Cannot connect to Engine Backend. (${e.message})`); }
    setDeIsProcessing(false);
  };

  const deHandleReset = async () => {
    if (confirm("WARNING: This will wipe out the entire DB and processed files. Are you sure?")) {
      try {
        await axios.post(`${API}/api/dyno/reset`);
        deAppendLog("⚠️ FACTORY RESET COMPLETE. Database has been wiped.");
        setDeProcessedTests([]);
      } catch (e) { deAppendLog(`Failed to reset DB: ${e.message}`); }
    }
  };

  const deHandleDeleteTest = async () => {
    if (!deDelTest) return;
    if (!confirm(`Delete test "${deDelTest}" and all its processed data?`)) return;
    try {
      const res = await axios.post(`${API}/api/dyno/delete_test`, { test_name: deDelTest });
      deAppendLog(res.data.message || res.data.error);
      deLoadProcessedTests();
    } catch (e) { deAppendLog(`Failed: ${e.message}`); }
  };

  const deHandlePromoteTest = async () => {
    if (!dePromoTest) return;
    try {
      const res = await axios.post(`${API}/api/dyno/promote_test`, { test_name: dePromoTest });
      deAppendLog(res.data.message || res.data.error);
    } catch (e) { deAppendLog(`Failed: ${e.message}`); }
  };

  const deHandlePasswordSubmit = () => {
    if (dePassword === "test@123") { setDeDevUnlocked(true); deAppendLog("🔓 Developer Mode Unlocked."); }
    else deAppendLog("❌ Invalid password.");
  };

  const deHandleFilesAdded = (fileList) => {
    const newFiles = Array.from(fileList).filter(f => f.name.endsWith('.xlsx'));
    setDeFiles(prev => [...prev, ...newFiles]);
    deAppendLog(newFiles.length > 0 ? `Queued ${newFiles.length} file(s) for ${deUploadMode}.` : "Error: .xlsx files only.");
  };

  const loadData = () => {
    setLoading(true);
    Promise.all([
      axios.get(`${API}/api/dyno/summaries`).catch(() => ({ data: [] })),
      axios.get(`${API}/api/dyno/fleet`).catch(() => ({ data: {} })),
    ]).then(([sumRes, fleetRes]) => {
      const sums = Array.isArray(sumRes.data) ? sumRes.data : [];
      setSummaries(sums);
      if (sums.length > 0 && !selectedTest) setSelectedTest(sums[0].Test_Name);
      setFleetData(fleetRes.data || {});
      setLoading(false);
    });
  };
  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedTest) return;
    setLoadingTelemetry(true);
    axios.get(`${API}/api/dyno/telemetry/${encodeURIComponent(selectedTest)}`)
      .then((r) => { setTelemetry(r.data); setLoadingTelemetry(false); })
      .catch(() => { setTelemetry(null); setLoadingTelemetry(false); });
  }, [selectedTest]);

  useEffect(() => {
    if (!selectedTest || activeTab !== "3d_sandbox") return;
    setLoadingRawTelemetry(true);
    axios.get(`${API}/api/dyno/raw_telemetry/${encodeURIComponent(selectedTest)}`)
      .then((r) => { setRawTelemetry(r.data); setLoadingRawTelemetry(false); })
      .catch(() => { setRawTelemetry(null); setLoadingRawTelemetry(false); });
  }, [selectedTest, activeTab]);

  useEffect(() => {
    const toFetch = compareTests.filter(t => !compareDataMap[t]);
    if (toFetch.length === 0) return;
    toFetch.forEach(t => {
      axios.get(`${API}/api/dyno/telemetry/${encodeURIComponent(t)}`)
        .then(r => setCompareDataMap(prev => ({ ...prev, [t]: r.data })));
    });
  }, [compareTests]);

  useEffect(() => {
    // load envelopes via API; allow retries and aggregate results
    const loadEnvelopes = async () => {
      const chs = ["IGBT", "Motor", "HighCell", "AFE"];
      try {
        const results = await Promise.all(chs.map((ch) =>
          axios.get(`${API}/api/dyno/envelope/${ch}`).then(r => ({ ch, data: r.data })).catch(e => ({ ch, data: null, error: e }))
        ));
        const next = {};
        results.forEach((res) => { if (res.data) next[res.ch] = res.data; });
        setEnvelopes(next);
        const missing = results.filter(r => !r.data).map(r => r.ch);
        if (missing.length > 0) console.warn("Envelopes missing for:", missing);
      } catch (e) {
        console.error("Failed to load envelopes:", e);
      }
    };

    loadEnvelopes();
  }, []);

  useEffect(() => {
    if (!historicalTest) { setHistoricalTelemetry(null); return; }
    setLoadingHistorical(true);
    axios.get(`${API}/api/dyno/telemetry/${encodeURIComponent(historicalTest)}`)
      .then(r => { setHistoricalTelemetry(r.data); setLoadingHistorical(false); })
      .catch(() => { setHistoricalTelemetry(null); setLoadingHistorical(false); });
  }, [historicalTest]);

  const selectedSummary = summaries.find((s) => s.Test_Name === selectedTest);
  const sandboxData = rawTelemetry && !rawTelemetry.error ? rawTelemetry : telemetry;
  const sandboxColumns = sandboxData ? Object.keys(sandboxData) : [];
  const sandboxXKey = sandboxColumns.includes(sandboxX) ? sandboxX : (sandboxColumns.includes("Time (s)") ? "Time (s)" : (sandboxColumns[0] || "Time (s)"));
  const sandboxPrimarySeries = sandboxY1.filter((key) => sandboxColumns.includes(key));
  const sandboxSecondarySeries = sandboxY2.filter((key) => sandboxColumns.includes(key));
  const sandboxZKey = sandboxZ !== "None" && sandboxColumns.includes(sandboxZ) ? sandboxZ : "None";
  const sandboxUsingRaw = Boolean(rawTelemetry && !rawTelemetry.error);
  const getEnvelopeSeries = (envelope, key) => {
    if (!envelope) return [];
    if (Array.isArray(envelope)) return envelope.map((row) => row?.[key]);
    return Array.isArray(envelope[key]) ? envelope[key] : [];
  };

  const getBikeNo = (name) => {
    if (!name) return "";
    const parts = name.split("-");
    const bike = parts.length > 1 ? parts[1].replace(/^0+/, "") : "";
    return bike;
  };

  const getPrimaryDeration = () => {
    if (!selectedSummary) return { comp: null, time: null, cell: "" };
    let firstTime = 9999, firstComp = null, firstCell = "";
    ["IGBT", "Motor", "HighCell", "AFE"].forEach(ch => {
      const d = selectedSummary[`${ch}_Deration_Time`];
      if (d && d !== "SAFE") {
        const t = parseFloat(d);
        if (t < firstTime) {
          firstTime = t; firstComp = ch;
          if (ch === "HighCell") {
            const c = selectedSummary["HighCell_Peak_Cell_No"];
            firstCell = c ? `**(Caused by Cell #${Math.round(c)})**` : "";
          }
        }
      }
    });
    return { comp: firstComp, time: firstTime === 9999 ? null : firstTime, cell: firstCell };
  };

  const { comp: firstDerationComp, time: firstDerationTime, cell: firstDerationCellStr } = getPrimaryDeration();
  const testDate = selectedSummary?.Test_Name.split("-")[0] || "---";
  const peakPower = telemetry?.["Electrical Power (kW)"]?.length
    ? `${Math.max(...telemetry["Electrical Power (kW)"]).toFixed(2)} kW (Max)`
    : (selectedSummary?.Power_Avg_120s ? `${selectedSummary.Power_Avg_120s.toFixed(2)} kW` : "Data Not Found");
  const dcirDisplay = selectedSummary?.Pack_DCIR_mOhm ? `${selectedSummary.Pack_DCIR_mOhm.toFixed(2)} mΩ` : "---";
  const totalDuration = telemetry ? Math.round(telemetry["Time (s)"][telemetry["Time (s)"].length - 1]) : "---";
  const dominantChannel = channels.reduce((best, ch) => {
    const bestVal = best ? Number(selectedSummary?.[`${best}_Raw_Max`] || 0) : -Infinity;
    const currentVal = Number(selectedSummary?.[`${ch}_Raw_Max`] || 0);
    return currentVal > bestVal ? ch : best;
  }, channels[0] || null);

  const loadBatteryData = async () => {
    setLoadingBattery(true);
    try {
      const res = await axios.get(`${API}/api/dyno/battery/${encodeURIComponent(selectedTest)}`);
      setBatteryData(res.data);
    } catch(e) {}
    setLoadingBattery(false);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <style>{`
        .dyno-shell {
          position: relative;
          isolation: isolate;
        }
        .dyno-shell::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 12% 18%, rgba(67,179,174, 0.12), transparent 28%),
            radial-gradient(circle at 84% 12%, rgba(255, 215, 0, 0.10), transparent 24%),
            radial-gradient(circle at 78% 68%, rgba(85, 170, 255, 0.10), transparent 26%);
          opacity: 0.9;
          z-index: -1;
        }
        .glass-panel {
          background: rgba(29, 30, 36, 0.82);
          border: 1px solid rgba(255,255,255,0.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(22px) saturate(130%);
          -webkit-backdrop-filter: blur(22px) saturate(130%);
        }
        .header-strip {
          background: rgba(25, 26, 32, 0.88);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .temp-status-card {
          position: relative;
          overflow: hidden;
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(28, 30, 38, 0.82), rgba(18, 20, 28, 0.58));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 18px 38px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .temp-status-card::after {
          content: "";
          position: absolute;
          inset: auto 0 0 0;
          height: 3px;
          background: var(--status-accent, #43B3AE);
        }
        .temp-status-card.safe {
          --status-accent: #43B3AE;
          border-color: rgba(67,179,174,0.34);
          background:
            linear-gradient(180deg, rgba(11, 52, 48, 0.86), rgba(13, 24, 28, 0.94)),
            linear-gradient(180deg, rgba(28, 30, 38, 0.82), rgba(18, 20, 28, 0.58));
        }
        .temp-status-card.breach {
          --status-accent: #FF4B4B;
          border-color: rgba(255,75,75,0.34);
          background:
            linear-gradient(180deg, rgba(58, 25, 34, 0.86), rgba(26, 18, 25, 0.95)),
            linear-gradient(180deg, rgba(28, 30, 38, 0.82), rgba(18, 20, 28, 0.58));
        }
        .temp-status-card.dominant {
          --status-accent: #FFD700;
          border-color: rgba(255,215,0,0.42);
          background:
            linear-gradient(180deg, rgba(66, 62, 22, 0.82), rgba(31, 30, 20, 0.94)),
            linear-gradient(180deg, rgba(28, 30, 38, 0.82), rgba(18, 20, 28, 0.58));
          box-shadow: 0 18px 38px rgba(0,0,0,0.25), 0 0 24px rgba(255,215,0,0.08), inset 0 1px 0 rgba(255,255,255,0.10);
        }
        .temp-card-kicker {
          color: var(--text-title);
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.4px;
          margin-bottom: 10px;
        }
        .temp-card-meta {
          font-size: 11px;
          color: var(--text-title);
        }
        .temp-card-divider {
          height: 1px;
          margin: 12px 0 10px;
          background: linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02));
        }
        .deration-banner-glass {
          background: linear-gradient(90deg, rgba(122, 38, 38, 0.48), rgba(44, 18, 24, 0.68));
          border: 1px solid rgba(255,75,75,0.34);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .tab-shell {
          display: flex;
          gap: 10px;
          margin-bottom: 24px;
          padding: 6px;
          background: linear-gradient(180deg, rgba(16, 24, 24, 0.84), rgba(13, 16, 22, 0.9));
          border: 1px solid rgba(67,179,174, 0.18);
          border-radius: 14px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 28px rgba(0,0,0,0.16);
          overflow-x: auto;
          flex-wrap: nowrap;
        }
        .tab-button {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 18px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.01);
          color: var(--text-sub);
          cursor: pointer;
          font-size: 14px;
          font-weight: 800;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .tab-button:hover {
          color: #dffef3;
          border-color: rgba(67,179,174, 0.26);
          background: rgba(67,179,174, 0.06);
        }
        .tab-button.active {
          color: #effff9;
          border-color: rgba(67,179,174, 0.5);
          background: linear-gradient(180deg, rgba(67,179,174, 0.18), rgba(0, 122, 94, 0.16));
          box-shadow: inset 0 -2px 0 #43B3AE, 0 10px 24px rgba(67,179,174, 0.12);
        }
        .sandbox-panel {
          border: 1px solid rgba(67,179,174, 0.18);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02), 0 18px 36px rgba(0,0,0,0.16);
        }
        .sandbox-control {
          border: 1px solid rgba(67,179,174, 0.14);
          border-radius: 14px;
          padding: 14px;
          background: linear-gradient(180deg, rgba(13, 26, 25, 0.58), rgba(18, 18, 24, 0.52));
        }
        .sandbox-caption {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(67,179,174, 0.14);
          background: linear-gradient(180deg, rgba(8, 44, 36, 0.34), rgba(14, 20, 25, 0.72));
          color: #bfeee0;
          font-size: 13px;
        }
        .sandbox-export {
          padding: 8px 14px;
          border-radius: 9px;
          border: 1px solid rgba(67,179,174, 0.28);
          background: rgba(67,179,174, 0.12);
          color: #dcfff3;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .fleet-card { background: var(--card-bg); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; transition: all 0.2s; cursor: pointer; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .fleet-card:hover { border-color: #43B3AE; background: rgba(67,179,174,0.05); transform: translateY(-3px); }
        .fleet-icon { margin-bottom: 12px; color: #43B3AE; }
        .fleet-vin { font-size: 14px; font-weight: 800; color: #FFF; margin-bottom: 2px; }
        .fleet-id { font-size: 12px; color: var(--text-sub); }
        .hw-box { background: rgba(255,255,255,0.03); border-left: 3px solid #43B3AE; padding: 12px 16px; border-radius: 4px; }
        .hw-label { color: var(--text-sub); font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
        .hw-value { color: #FFF; font-size: 13px; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; color: var(--text-sub); border-bottom: 1px solid rgba(255,255,255,0.1); }
        td { padding: 12px; font-size: 12px; color: #FFF; border-bottom: 1px solid rgba(255,255,255,0.05); }
      `}</style>
      
      <DynoSidebar
        appMode={appMode} setAppMode={setAppMode}
        activeTab={activeTab} setActiveTab={setActiveTab}
        summaries={summaries}
        selectedTest={selectedTest} setSelectedTest={setSelectedTest}
        compareTests={compareTests} setCompareTests={setCompareTests}
        channels={channels} setChannels={setChannels}
        envelopeMode={envelopeMode} setEnvelopeMode={setEnvelopeMode}
        tolerancePct={tolerancePct} setTolerancePct={setTolerancePct}
        snapshotDuration={snapshotDuration} setSnapshotDuration={setSnapshotDuration}
        onRefresh={loadData}
      />

      <main style={{ flex: 1, padding: "30px 40px", overflowY: "auto", background: "var(--bg-color)" }}>
        {appMode === "Monitor Dashboard" && (
          <div className="dyno-shell" style={{ width: "100%", maxWidth: "none", margin: "0 0 0 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 25 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <Image src="/raptee_logo.png" alt="Raptee" width={140} height={44} style={{ opacity: 0.98 }} />
                <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: 20 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 900, color: "#FFF", marginBottom: 4 }}>VCH - Dyno Thermal Monitor</h1>
                  <p style={{ color: "var(--text-sub)", fontSize: 13 }}><b>Target:</b> <span style={{ color: "#43B3AE", fontWeight: 700 }}>{selectedTest || "No Selection"}</span></p>
                </div>
              </div>
              <button className="glass-panel" onClick={() => { if (!telemetry) return; const allCols = Object.keys(telemetry); downloadCSV(allCols, telemetry, `${(selectedTest || "dyno").slice(0,10)}_full_trace.csv`); }} style={{ padding: "8px 16px", borderRadius: 10, backgroundColor: "rgba(29,30,36,0.65)", color: "#ddd", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Download size={14} /> Export FULL 2Hz Trace
              </button>
            </div>

            <div className="header-strip" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 14, padding: "14px 20px", marginBottom: 20 }}>
              {[{ label: "TEST DATE", value: `📅 ${testDate}` }, { label: "TEST TYPE", value: "🏍️ Dyno Thermal" }, { label: "DYNO SET SPEED", value: "🏁 60 kmph" }, { label: "ELECTRICAL POWER", value: `⚡ ${peakPower}` }, { label: "PACK DCIR", value: `🔋 ${dcirDisplay}`, accent: true }, { label: "TOTAL DURATION", value: `⏱️ ${totalDuration} s` }].map((item, i, arr) => (
                <React.Fragment key={item.label}><div style={{ textAlign: "center", minWidth: 130 }}><div style={{ color: "var(--text-title)", fontSize: 10, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{item.label}</div><div style={{ color: item.accent ? "#43B3AE" : "var(--text-main)", fontWeight: 700, fontSize: 14 }}>{item.value}</div></div>{i < arr.length - 1 && <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", height: 24 }} />}</React.Fragment>
              ))}
            </div>

            {/* Envelopes status banner */}
            {Object.keys(envelopes).length < channels.length && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,165,0,0.04)", border: "1px solid rgba(255,165,0,0.12)", color: "#FFC87C", padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontWeight: 800 }}>Envelopes not loaded for all channels — some reference traces are missing.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => {
                    const chs = ["IGBT","Motor","HighCell","AFE"];
                    Promise.all(chs.map((ch) => axios.get(`${API}/api/dyno/envelope/${ch}`).then(r => ({ ch, data: r.data })).catch(e => ({ ch, data: null })))).then(results => {
                      const next = {};
                      results.forEach(r => { if (r.data) next[r.ch] = r.data; });
                      setEnvelopes(next);
                      const missing = results.filter(r => !r.data).map(r => r.ch);
                      if (missing.length === 0) return; // still missing some
                    }).catch(e => console.error(e));
                  }} style={{ background: "rgba(255,165,0,0.12)", border: "1px solid rgba(255,165,0,0.18)", color: "#222", padding: "8px 12px", borderRadius: 8, fontWeight: 800, cursor: "pointer" }}>Retry Envelopes</button>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${channels.length}, 1fr)`, gap: 16, marginBottom: 16 }}>
              {channels.map((ch) => {
                const maxVal = selectedSummary?.[`${ch}_Raw_Max`] || 0;
                const limit = LIMIT_MAP[ch];
                const peakTime = selectedSummary?.[`${ch}_Peak_Time`] || 0;
                const derationVal = selectedSummary?.[`${ch}_Deration_Time`] || "SAFE";
                const isBreach = String(derationVal) !== "SAFE";
                const isDominant = ch === dominantChannel;
                const borderS = isBreach ? "1px solid rgba(255,75,75,0.34)" : isDominant ? "1px solid rgba(255,215,0,0.42)" : "1px solid rgba(67,179,174,0.34)";
                const shadowS = isBreach ? "0 18px 38px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,75,75,0.06), inset 0 1px 0 rgba(255,255,255,0.08)" : isDominant ? "0 18px 38px rgba(0,0,0,0.25), 0 0 24px rgba(255,215,0,0.08), inset 0 1px 0 rgba(255,255,255,0.10)" : "0 18px 38px rgba(0,0,0,0.25), 0 0 0 1px rgba(67,179,174,0.06), inset 0 1px 0 rgba(255,255,255,0.08)";
                let extraInfo = ch === "HighCell" ? (selectedSummary?.["HighCell_Peak_Cell_No"] ? ` | Cell: #${Math.round(selectedSummary["HighCell_Peak_Cell_No"])}` : "") : "";

                return (
                  <div key={ch} className={`temp-status-card ${isBreach ? "breach" : "safe"} ${isDominant ? "dominant" : ""}`} style={{ border: borderS, boxShadow: shadowS, padding: "20px 18px" }}>
                    <div className="temp-card-kicker">{ch} RAW MAX TEMP</div>
                    <div style={{ color: isBreach ? "#FF4B4B" : "#FFF", fontSize: 32, fontWeight: 800 }}>{maxVal.toFixed ? maxVal.toFixed(2) : maxVal} °C</div>
                    <div className="temp-card-meta" style={{ marginTop: 6 }}>Peak @ {peakTime}s{extraInfo}</div>
                    <div className="temp-card-divider" />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                      <span style={{ color: "var(--text-sub)" }}>Limit: {limit}°C | </span>
                      {isBreach ? <span style={{ color: "#FF4B4B", fontWeight: 800 }}>⚠️ BREACH</span> : <span style={{ color: "#43B3AE", fontWeight: 800 }}>✅ SAFE</span>}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11 }}>{isBreach ? <span style={{ fontWeight: 700 }}>Derated @ <strong>{derationVal}s</strong></span> : <span style={{ color: "var(--text-sub)" }}>0s</span>}</div>
                  </div>
                );
              })}
            </div>

            {firstDerationComp && <div className="deration-banner-glass" style={{ borderRadius: 12, padding: "13px 20px", marginBottom: 20, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#FF5E5E" }}>⚠️ First Deration: <strong>{firstDerationComp}</strong> exceeded <strong>{LIMIT_MAP[firstDerationComp]}°C</strong> safety limit at <strong>{firstDerationTime}s</strong>{firstDerationCellStr ? ` — ${firstDerationCellStr}` : ""}</div>}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: 20 }} />

            <div className="tab-shell">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`tab-button ${activeTab === tab.id ? "active" : ""}`}>{tab.icon} {tab.label}</button>
              ))}
            </div>

            {activeTab === "rise_rate" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {channels.map((ch) => {
                  const dTdtCol = COL_MAP[ch]?.dTdt || `${ch}_dTdt`;
                  const data = [{ x: telemetry?.["Time (s)"], y: telemetry?.[dTdtCol], name: selectedTest, type: "scatter", mode: "lines", line: { color: "#43B3AE", width: 3, shape: "spline", smoothing: 0.8 } }];
                  compareTests.forEach(t => { if (compareDataMap[t]) data.push({ x: compareDataMap[t]["Time (s)"], y: compareDataMap[t][dTdtCol], name: t, type: "scatter", mode: "lines", line: { width: 1.5, dash: "dot" } }); });
                  if (envelopes[ch]) {
                    const env = envelopes[ch];
                    const tol = tolerancePct;
                    const envLabel = envelopeMode === "Statistical (2-Sigma)" ? "2-Sigma" : `+/-${tol}%`;
                    const up = envelopeMode === "Statistical (2-Sigma)" ? "dTdt_Upper_2Sigma" : `dTdt_Upper_${tol}Pct`;
                    const low = envelopeMode === "Statistical (2-Sigma)" ? "dTdt_Lower_2Sigma" : `dTdt_Lower_${tol}Pct`;
                    const envTime = getEnvelopeSeries(env, "Time (s)");
                    const meanSeries = getEnvelopeSeries(env, "dTdt_Mean");
                    const upperSeries = getEnvelopeSeries(env, up);
                    const lowerSeries = getEnvelopeSeries(env, low);
                    if (envTime.length && meanSeries.length && upperSeries.length && lowerSeries.length) {
                      data.push({ x: envTime, y: meanSeries, name: "Mean", type: "scatter", mode: "lines", line: { color: "#8A8A93", width: 2, dash: "dash", shape: "spline", smoothing: 0.8 } });
                      data.push({ x: envTime, y: upperSeries, name: `Upper (${envLabel})`, type: "scatter", mode: "lines", line: { color: "cyan", width: 1, dash: "dot", shape: "spline", smoothing: 0.8 } });
                      data.push({ x: envTime, y: lowerSeries, name: `Lower (${envLabel})`, type: "scatter", mode: "lines", line: { color: "cyan", width: 1, dash: "dot", shape: "spline", smoothing: 0.8 }, fill: "tonexty", fillcolor: "rgba(0,255,255,0.05)" });
                    }
                  }
                  return (
                    <div key={ch} className="metric-card sandbox-panel" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>{ch} Rise Rate</div>
                      <Plot data={data} layout={{ ...DARK_TOOLTIP, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#A0A0AB", size: 10 }, height: 300, margin: { t: 10, b: 30, l: 40, r: 10 }, xaxis: { title: "Time (s)", showgrid: false }, yaxis: { title: "dT/dt (°C/s)", showgrid: true, gridcolor: "rgba(255,255,255,0.05)" }, showlegend: true, legend: { orientation: "h", y: -0.2 } }} config={{ displayModeBar: true, displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d"], toImageButtonOptions: { format: "png", filename: `${ch.toLowerCase()}_rise_rate`, scale: 2 } }} style={{ width: "100%" }} />
                      <button onClick={() => { if (!telemetry) return; downloadCSV(["Time (s)", dTdtCol], telemetry, `${(selectedTest || "dyno").slice(0,10)}_${ch}_dTdt.csv`); }} style={{ width: "100%", marginTop: 10, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#A0A0AB", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#43B3AE"; e.currentTarget.style.color = "#43B3AE"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#A0A0AB"; }}><Download size={13} /> Export {ch} dT/dt Data</button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "cumulative" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {channels.map((ch) => {
                  const dTCol = COL_MAP[ch]?.dT || `${ch}_dT`;
                  const data = [{ x: telemetry?.["Time (s)"], y: telemetry?.[dTCol], name: selectedTest, type: "scatter", mode: "lines", line: { color: "#19D3A2", width: 3, shape: "spline", smoothing: 0.8 } }];
                  compareTests.forEach(t => { if (compareDataMap[t]) data.push({ x: compareDataMap[t]["Time (s)"], y: compareDataMap[t][dTCol], name: t, mode: "lines", line: { width: 1.5, dash: "dot" } }); });
                  if (envelopes[ch]) {
                    const env = envelopes[ch];
                    const tol = tolerancePct;
                    const envLabel = envelopeMode === "Statistical (2-Sigma)" ? "2-Sigma" : `+/-${tol}%`;
                    const up = envelopeMode === "Statistical (2-Sigma)" ? "dT_Upper_2Sigma" : `dT_Upper_${tol}Pct`;
                    const low = envelopeMode === "Statistical (2-Sigma)" ? "dT_Lower_2Sigma" : `dT_Lower_${tol}Pct`;
                    const envTime = getEnvelopeSeries(env, "Time (s)");
                    const meanSeries = getEnvelopeSeries(env, "dT_Mean");
                    const upperSeries = getEnvelopeSeries(env, up);
                    const lowerSeries = getEnvelopeSeries(env, low);
                    if (envTime.length && meanSeries.length && upperSeries.length && lowerSeries.length) {
                      data.push({ x: envTime, y: meanSeries, name: "Mean", type: "scatter", mode: "lines", line: { color: "#8A8A93", width: 2, dash: "dash", shape: "spline", smoothing: 0.8 } });
                      data.push({ x: envTime, y: upperSeries, name: `Upper (${envLabel})`, type: "scatter", mode: "lines", line: { color: "cyan", dash: "dot", width: 1, shape: "spline", smoothing: 0.8 } });
                      data.push({ x: envTime, y: lowerSeries, name: `Lower (${envLabel})`, type: "scatter", mode: "lines", line: { color: "cyan", dash: "dot", width: 1, shape: "spline", smoothing: 0.8 }, fill: "tonexty", fillcolor: "rgba(0,255,255,0.05)" });
                    }
                  }
                  return (
                    <div key={ch} className="metric-card sandbox-panel" style={{ padding: 16 }}>
                      <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: 12 }}>{ch} Cumulative Rise</div>
                      <Plot data={data} layout={{ ...DARK_TOOLTIP, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#A0A0AB", size: 10 }, height: 300, margin: { t: 10, b: 30, l: 40, r: 10 }, xaxis: { title: "Time (s)", showgrid: false }, yaxis: { title: "ΔT (°C)", showgrid: true, gridcolor: "rgba(255,255,255,0.05)" }, showlegend: true, legend: { orientation: "h", y: -0.2 }, hovermode: "x unified" }} config={{ displayModeBar: true, displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d"], toImageButtonOptions: { format: "png", filename: `${ch.toLowerCase()}_cumulative_rise`, scale: 2 } }} style={{ width: "100%" }} />
                      <button onClick={() => { if (!telemetry) return; downloadCSV(["Time (s)", dTCol], telemetry, `${(selectedTest || "dyno").slice(0,10)}_${ch}_DeltaT.csv`); }} style={{ width: "100%", marginTop: 10, padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#A0A0AB", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#43B3AE"; e.currentTarget.style.color = "#43B3AE"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#A0A0AB"; }}><Download size={13} /> Export {ch} ΔT Data</button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "3d_sandbox" && (
              <div className="metric-card sandbox-panel" style={{ position: "relative", zIndex: 100, padding: 24 }}>
                <div className="sandbox-caption">
                  <span>
                    {loadingRawTelemetry
                      ? "Loading full-resolution telemetry for the selected test."
                      : sandboxUsingRaw
                        ? `Full Resolution Mode: plotting ${sandboxData?.[sandboxXKey]?.length || 0} raw telemetry points across the full timestamp range.`
                        : "Raw Excel source was not found, so the sandbox is temporarily falling back to processed telemetry."}
                  </span>
                  {sandboxColumns.length > 0 && (
                    <button
                      className="sandbox-export"
                      onClick={() => {
                        const colsToExport = [sandboxXKey, ...sandboxPrimarySeries, ...sandboxSecondarySeries];
                        if (sandboxZKey !== "None") colsToExport.push(sandboxZKey);
                        const uniqueCols = [...new Set(colsToExport)].filter((col) => sandboxColumns.includes(col));
                        const rowCount = sandboxData?.[sandboxXKey]?.length || 0;
                        const csvRows = [uniqueCols.join(",")];
                        for (let i = 0; i < rowCount; i += 1) {
                          csvRows.push(uniqueCols.map((col) => {
                            const value = sandboxData?.[col]?.[i];
                            if (value === null || value === undefined) return "";
                            const text = String(value);
                            return text.includes(",") ? `"${text.replace(/"/g, '""')}"` : text;
                          }).join(","));
                        }
                        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `${selectedTest || "dyno"}_full_resolution_plot.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export Full Resolution Data
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                  <div className="sandbox-control"><div style={{ fontSize: 12, color: "#BEE9DA", marginBottom: 8, fontWeight: 800 }}>X Axis</div><StreamlitSelect value={sandboxXKey} onChange={setSandboxX} options={sandboxColumns.length ? sandboxColumns : ["Time (s)"]} /></div>
                  <div className="sandbox-control"><div style={{ fontSize: 12, color: "#BEE9DA", marginBottom: 8, fontWeight: 800 }}>Y Primary</div><StreamlitMultiSelect value={sandboxPrimarySeries} onChange={setSandboxY1} options={sandboxColumns} /></div>
                  <div className="sandbox-control"><div style={{ fontSize: 12, color: "#BEE9DA", marginBottom: 8, fontWeight: 800 }}>Y Secondary</div><StreamlitMultiSelect value={sandboxSecondarySeries} onChange={setSandboxY2} options={sandboxColumns} /></div>
                  <div className="sandbox-control"><div style={{ fontSize: 12, color: "#BEE9DA", marginBottom: 8, fontWeight: 800 }}>Color (Z)</div><StreamlitSelect value={sandboxZKey} onChange={setSandboxZ} options={sandboxColumns.length ? ["None", ...sandboxColumns] : ["None"]} /></div>
                </div>
                {(sandboxPrimarySeries.length > 0 || sandboxSecondarySeries.length > 0) ? (
                  <>
                    <Plot
                      data={sandboxZKey !== "None"
                        ? [{
                            x: sandboxData?.[sandboxXKey],
                            y: sandboxData?.[sandboxPrimarySeries[0] || sandboxSecondarySeries[0]],
                            z: sandboxData?.[sandboxZKey],
                            name: sandboxPrimarySeries[0] || sandboxSecondarySeries[0],
                            type: "scatter3d",
                            mode: "markers",
                            marker: {
                              size: 4,
                              opacity: 0.72,
                              color: sandboxData?.[sandboxZKey],
                              colorscale: "Turbo",
                              colorbar: { title: sandboxZKey, tickfont: { color: "#C9F6E6" } }
                            }
                          }]
                        : [
                            ...sandboxPrimarySeries.map((y, idx) => ({
                              x: sandboxData?.[sandboxXKey],
                              y: sandboxData?.[y],
                              name: `${y} (L)`,
                              type: "scatter",
                              mode: "lines",
                              line: { color: ["#43B3AE", "#2DD4BF", "#7CE7C5", "#B6F09C"][idx % 4], width: 2.4, shape: "spline", smoothing: 0.8 }
                            })),
                            ...sandboxSecondarySeries.map((y, idx) => ({
                              x: sandboxData?.[sandboxXKey],
                              y: sandboxData?.[y],
                              name: `${y} (R)`,
                              type: "scatter",
                              mode: "lines",
                              yaxis: "y2",
                              line: { color: ["#FFE66D", "#7FDBFF", "#A1FFCE", "#D9F99D"][idx % 4], width: 2, dash: "dot", shape: "spline", smoothing: 0.8 }
                            }))
                          ]}
                      layout={sandboxZKey !== "None"
                        ? {
                            ...DARK_TOOLTIP,
                            paper_bgcolor: "rgba(0,0,0,0)",
                            plot_bgcolor: "rgba(0,0,0,0)",
                            font: { color: "#E0E0E0", size: 12 },
                            height: 600,
                            margin: { t: 20, b: 10, l: 0, r: 0 },
                            scene: {
                              bgcolor: "rgba(0,0,0,0)",
                              xaxis: { title: sandboxXKey, gridcolor: "rgba(67,179,174,0.10)", zerolinecolor: "rgba(67,179,174,0.18)" },
                              yaxis: { title: sandboxPrimarySeries[0] || sandboxSecondarySeries[0], gridcolor: "rgba(67,179,174,0.10)", zerolinecolor: "rgba(67,179,174,0.18)" },
                              zaxis: { title: sandboxZKey, gridcolor: "rgba(67,179,174,0.10)", zerolinecolor: "rgba(67,179,174,0.18)" }
                            }
                          }
                        : {
                            ...DARK_TOOLTIP,
                            paper_bgcolor: "rgba(0,0,0,0)",
                            plot_bgcolor: "rgba(0,0,0,0)",
                            font: { color: "#E0E0E0", size: 12 },
                            height: 600,
                            hovermode: "x unified",
                            margin: { t: 20, b: 60, l: 60, r: 60 },
                            xaxis: { title: sandboxXKey, showgrid: false, zeroline: false },
                            yaxis: { title: "Left Axis (Primary)", showgrid: true, gridcolor: "rgba(67,179,174,0.10)", zeroline: false },
                            yaxis2: { title: "Right Axis (Secondary)", overlaying: "y", side: "right", showgrid: false, zeroline: false },
                            legend: { orientation: "h", y: -0.14 }
                          }}
                      config={{ displayModeBar: true, displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d"], toImageButtonOptions: { format: "png", filename: "dyno_dynamic_plotter", scale: 2 } }}
                      style={{ width: "100%" }}
                    />
                    {sandboxZKey !== "None" && (sandboxPrimarySeries.length + sandboxSecondarySeries.length > 1) && (
                      <div style={{ marginTop: 12, color: "#FFD98B", fontSize: 12, fontWeight: 700 }}>
                        3D mode follows Streamlit behavior and renders the first selected Y axis only.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "70px 20px", color: "var(--text-sub)", border: "1px dashed rgba(67,179,174,0.2)", borderRadius: 14 }}>
                    Select at least one Y-axis channel to start plotting the full telemetry timeline.
                  </div>
                )}
              </div>
            )}

            {activeTab === "power_analysis" && (() => {
               const goldenPowers = summaries
                 .filter((row) => GOLDEN_BIKES.some((gold) => row.Test_Name?.includes(gold)))
                 .map((row) => Number(row.Power_Avg_120s || 0))
                 .filter((pwr) => pwr >= 19 && pwr <= 20.5);
               const mPwr = goldenPowers.length > 0 ? goldenPowers.reduce((a, b) => a + b, 0) / goldenPowers.length : 19.5;
               const pUp = mPwr * 1.10;
               const pLow = mPwr * 0.90;
               const powerRecords = summaries.map((row) => {
                 const testName = row.Test_Name || "";
                 const bikePower = Number(row.Power_Avg_120s || 0);
                 const isGolden = GOLDEN_BIKES.some((gold) => testName.includes(gold));
                 const status = pLow <= bikePower && bikePower <= pUp ? "PASS" : "FAIL";
                 return {
                   testName,
                   bikeId: getBikeNo(testName),
                   type: isGolden ? "Golden" : "Evaluation",
                   avgPower: Number(bikePower.toFixed(2)),
                   status
                 };
               });
               const passed = powerRecords.filter((row) => row.status === "PASS");
               const failed = powerRecords.filter((row) => row.status === "FAIL");

               return (
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:"var(--text-main)",marginBottom:16}}>⚡ Electrical Power Analysis (120s Snapshot)</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>
                      <div className="metric-card" style={{padding:"16px 20px"}}>
                        <div style={{fontSize:12,color:"var(--text-sub)",marginBottom:6}}>Golden Mean Power</div>
                        <div style={{fontSize:22,fontWeight:900,color:"#FFD700"}}>{mPwr.toFixed(2)} kW</div>
                      </div>
                      <div className="metric-card" style={{padding:"16px 20px"}}>
                        <div style={{fontSize:12,color:"var(--text-sub)",marginBottom:6}}>Upper Boundary (+10%)</div>
                        <div style={{fontSize:22,fontWeight:900,color:"#43B3AE"}}>{pUp.toFixed(2)} kW</div>
                      </div>
                      <div className="metric-card" style={{padding:"16px 20px"}}>
                        <div style={{fontSize:12,color:"var(--text-sub)",marginBottom:6}}>Lower Boundary (-10%)</div>
                        <div style={{fontSize:22,fontWeight:900,color:"#FF4B4B"}}>{pLow.toFixed(2)} kW</div>
                      </div>
                    </div>
                    <div className="metric-card" style={{padding:20, marginBottom:20}}>
                       <Plot
                         data={[{
                           x: powerRecords.map((row) => row.testName),
                           y: powerRecords.map((row) => row.avgPower),
                           text: powerRecords.map((row) => row.avgPower.toFixed(2)),
                           type: "bar",
                           marker: { color: powerRecords.map((row) => row.status === "PASS" ? "#43B3AE" : "#FF4B4B") },
                           hovertemplate: "Test: %{x}<br>Power: %{y:.2f} kW<extra></extra>"
                         }]}
                         layout={{
                           ...DARK_TOOLTIP,
                           paper_bgcolor: "rgba(0,0,0,0)",
                           plot_bgcolor: "rgba(0,0,0,0)",
                           font: { color: "#A0A0AB", size: 10 },
                           height: 400,
                           hovermode: "x unified",
                           margin: { t: 30, b: 80, l: 50, r: 20 },
                           xaxis: {
                             title: "Bike ID",
                             showgrid: false,
                             zeroline: false,
                             tickmode: "array",
                             tickvals: powerRecords.map((row) => row.testName),
                             ticktext: powerRecords.map((row) => row.bikeId),
                             tickangle: 0,
                             automargin: true,
                             tickfont: { color: "#BFC3D9", size: 11 }
                           },
                           yaxis: {
                             title: "Mean Power (kW)",
                             showgrid: true,
                             gridcolor: "rgba(128,128,128,0.2)",
                             zeroline: false,
                             automargin: true,
                             tickfont: { color: "#BFC3D9", size: 11 }
                           },
                           shapes: [
                             { type: "line", y0: pUp, y1: pUp, x0: 0, x1: 1, xref: "paper", line: { color: "cyan", width: 1, dash: "dash" } },
                             { type: "line", y0: pLow, y1: pLow, x0: 0, x1: 1, xref: "paper", line: { color: "cyan", width: 1, dash: "dash" } },
                             { type: "line", y0: mPwr, y1: mPwr, x0: 0, x1: 1, xref: "paper", line: { color: "gold", width: 2 } }
                           ],
                           annotations: [
                             { x: 1, xref: "paper", y: pUp, yref: "y", text: "Upper Limit", showarrow: false, xanchor: "right", yanchor: "bottom", font: { size: 10, color: "cyan" } },
                             { x: 1, xref: "paper", y: pLow, yref: "y", text: "Lower Limit", showarrow: false, xanchor: "right", yanchor: "top", font: { size: 10, color: "cyan" } },
                             { x: 1, xref: "paper", y: mPwr, yref: "y", text: "Golden Mean", showarrow: false, xanchor: "right", yanchor: "bottom", font: { size: 10, color: "gold" } }
                           ]
                         }}
                         config={{
                           displayModeBar: true,
                           displaylogo: false,
                           responsive: true,
                           modeBarButtonsToRemove: ["lasso2d", "select2d"],
                           toImageButtonOptions: { format: "png", filename: "dyno_power_analysis", scale: 2 }
                         }}
                         style={{width: "100%"}}
                       />
                    </div>
                    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:20}}>
                       <div className="metric-card" style={{padding:16}}>
                          <div style={{color:"#43B3AE", fontWeight:800, marginBottom:10}}>✅ Passed Power Criteria</div>
                          <div style={{maxHeight:300, overflowY:"auto"}}>
                             <table><thead><tr><th>Test Name</th><th>Type</th><th>Power (kW)</th></tr></thead><tbody>{passed.map((row)=><tr key={row.testName}><td>{row.testName}</td><td>{row.type}</td><td>{row.avgPower.toFixed(2)}</td></tr>)}</tbody></table>
                          </div>
                       </div>
                       <div className="metric-card" style={{padding:16}}>
                          <div style={{color:"#FF4B4B", fontWeight:800, marginBottom:10}}>❌ Failed Power Criteria</div>
                          <div style={{maxHeight:300, overflowY:"auto"}}>
                             <table><thead><tr><th>Test Name</th><th>Type</th><th>Power (kW)</th></tr></thead><tbody>{failed.map((row)=><tr key={row.testName}><td>{row.testName}</td><td>{row.type}</td><td>{row.avgPower.toFixed(2)}</td></tr>)}</tbody></table>
                          </div>
                       </div>
                    </div>
                     <button onClick={() => { const headers = ["Test Name", "Type", "Avg Power (kW)", "Status"]; const rows = powerRecords.map(r => [r.testName, r.type, r.avgPower, r.status]); downloadTableCSV(headers, rows, "Dyno_Power_Analysis.csv"); }} style={{ marginTop: 20, padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#A0A0AB", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#43B3AE"; e.currentTarget.style.color = "#43B3AE"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#A0A0AB"; }}><Download size={14} /> Export Power Validation Data</button>
                  </div>
               );
            })()}

            {activeTab === "battery_health" && (() => {
                const gBikes = ["2025_10_22-07-BK", "2025_10_09-14-BK", "2025_10_25-09-BK", "2025_10_20-15-BK", "2025_10_19-17-BK", "2025_10_25-04-BK"];
                const gDCIRs = summaries.filter(s => gBikes.some(g => s.Test_Name?.includes(g)) && s.Pack_DCIR_mOhm > 0).map(s => s.Pack_DCIR_mOhm);
                const gDCIR = gDCIRs.length ? gDCIRs.reduce((a,b)=>a+b,0)/gDCIRs.length : 50.0;
                const dLimit = gDCIR * 1.15;
                const vCol = batteryData ? Object.keys(batteryData).find(k => k.toLowerCase().includes("voltage") || k.includes("V_") || k.includes("Pack_V") || k.includes("Cumm_Volatge") || k.includes("Cumm_Voltage") || k.includes("DC_Volatge") || k.includes("DC_Voltage")) : null;
                const cCol = batteryData ? Object.keys(batteryData).find(k => k.toLowerCase().includes("current") || k.includes("I_") || k.includes("Pack_I") || k.includes("FG_Current") || k.includes("DC_Current")) : null;
                const bPwrs = summaries.filter(s => s.Pack_DCIR_mOhm).sort((a,b)=>a.Pack_DCIR_mOhm-b.Pack_DCIR_mOhm);
                const passed = bPwrs.filter(s => s.Pack_DCIR_mOhm <= dLimit);
                const failed = bPwrs.filter(s => s.Pack_DCIR_mOhm > dLimit);

                let dynDCIR = 0, restPt = null, loadPt = null;
                if (batteryData && vCol && cCol) {
                  try {
                    const times = batteryData["Time (s)"];
                    const curs = batteryData[cCol];
                    const vols = batteryData[vCol];
                    const firstCrossIdx = curs.findIndex(v => Math.abs(v) > 30.0);
                    if (firstCrossIdx !== -1) {
                      const start = Math.max(0, firstCrossIdx - 60);
                      let minCur = Infinity, rIdx = firstCrossIdx;
                      for (let i=start; i<=firstCrossIdx; i++) {
                        if (Math.abs(curs[i]) < minCur) { minCur = Math.abs(curs[i]); rIdx = i; }
                      }
                      const end = Math.min(curs.length - 1, firstCrossIdx + 60);
                      const meanCur = curs.reduce((a,b)=>a+b,0)/curs.length;
                      let lIdx = firstCrossIdx;
                      if (meanCur < 0) {
                        let minV = Infinity;
                        for (let i=firstCrossIdx; i<=end; i++) { if (curs[i] < minV) { minV = curs[i]; lIdx = i; } }
                      } else {
                        let maxV = -Infinity;
                        for (let i=firstCrossIdx; i<=end; i++) { if (curs[i] > maxV) { maxV = curs[i]; lIdx = i; } }
                      }
                      const dI = Math.abs(curs[lIdx] - curs[rIdx]);
                      if (dI > 15.0) {
                        dynDCIR = (Math.abs(vols[rIdx] - vols[lIdx]) / dI) * 1000;
                        restPt = { t: times[rIdx], v: vols[rIdx], i: curs[rIdx] };
                        loadPt = { t: times[lIdx], v: vols[lIdx], i: curs[lIdx] };
                      }
                    }
                  } catch(e) { console.error(e); }
                }

               return (
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20}}>
                      <div className="metric-card" style={{padding:"16px 20px"}}><div style={{fontSize:12,color:"var(--text-sub)",marginBottom:6}}>📊 Computed DCIR Result</div><div style={{fontSize:22,fontWeight:900,color:dynDCIR>0?"#43B3AE":"var(--text-sub)"}}>{dynDCIR > 0 ? `${dynDCIR.toFixed(2)} mΩ` : "N/A"}</div></div>
                      <div className="metric-card" style={{padding:"16px 20px"}}><div style={{fontSize:12,color:"var(--text-sub)",marginBottom:6}}>👑 Golden Mean DCIR</div><div style={{fontSize:22,fontWeight:900,color:"#FFD700"}}>{gDCIR.toFixed(2)} mΩ</div></div>
                      <div className="metric-card" style={{padding:"16px 20px"}}><div style={{fontSize:12,color:"var(--text-sub)",marginBottom:6}}>⚠️ Degradation Limit (+15%)</div><div style={{fontSize:22,fontWeight:900,color:"#FF4B4B"}}>{dLimit.toFixed(2)} mΩ</div></div>
                    </div>
                    <div className="metric-card" style={{padding:"16px",marginBottom:20}}>
                        <div style={{fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span>⚡ Voltage Sag vs. Current Draw — {selectedTest}</span><button onClick={loadBatteryData} disabled={loadingBattery} style={{background:"rgba(67,179,174,0.15)",border:"1px solid rgba(67,179,174,0.3)",color:"#43B3AE",padding:"6px 14px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700}}>{loadingBattery ? "Loading..." : "Load Raw Data"}</button></div>
                        {batteryData ? (
                          <Plot data={[
                            {x:batteryData["Time (s)"],y:batteryData[cCol || "Current (A)"],type:"scatter",mode:"lines",name:"Current (A)",line:{color:"#FF4B4B",width:2}}, 
                            {x:batteryData["Time (s)"],y:batteryData[vCol || "Voltage (V)"],type:"scatter",mode:"lines",name:"Voltage (V)",yaxis:"y2",line:{color:"#43B3AE",width:2}},
                            restPt && {x:[restPt.t, loadPt.t], y:[restPt.i, loadPt.i], type:"scatter", mode:"markers", name:"Current Pts", marker:{color:"yellow", size:10, symbol:"x"}},
                            restPt && {x:[restPt.t, loadPt.t], y:[restPt.v, loadPt.v], type:"scatter", mode:"markers", name:"Voltage Pts", yaxis:"y2", marker:{color:"yellow", size:10, symbol:"circle-open", line:{width:2}}}
                          ].filter(Boolean)} layout={{ ...DARK_TOOLTIP, paper_bgcolor:"rgba(0,0,0,0)",plot_bgcolor:"rgba(0,0,0,0)",font:{color:"#E0E0E0",size:11},height:450,hovermode:"x unified",margin:{t:20,b:50,l:60,r:60},xaxis:{title:"Time (s)",showgrid:false},yaxis:{title:"Current (A)",gridcolor:"rgba(255,255,255,0.05)"},yaxis2:{title:"Voltage (V)",overlaying:"y",side:"right",showgrid:false},legend:{orientation:"h",y:1.05} }} config={{responsive:true, displaylogo:false}} style={{width:"100%"}} />
                        ) : <div style={{textAlign:"center",padding:50,color:"var(--text-sub)"}}>Click Load Raw Data to fetch high-resolution traces and compute live DCIR.</div>}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}><div className="metric-card" style={{padding:16}}><div style={{color:"#43B3AE",fontWeight:800,marginBottom:10}}>✅ DCIR Validated Vehicles ({passed.length})</div><div style={{maxHeight:300,overflowY:"auto"}}><table><thead><tr><th>Vehicle</th><th>DCIR (mΩ)</th><th>Verdict</th></tr></thead><tbody>{passed.map(s=><tr key={s.Test_Name}><td>{getBikeNo(s.Test_Name)}</td><td>{s.Pack_DCIR_mOhm.toFixed(2)}</td><td style={{color:"#43B3AE",fontWeight:700}}>PASS</td></tr>)}</tbody></table></div></div><div className="metric-card" style={{padding:16}}><div style={{color:"#FF4B4B",fontWeight:800,marginBottom:10}}>❌ Excessive Battery Sag/DCIR ({failed.length})</div><div style={{maxHeight:300,overflowY:"auto"}}><table><thead><tr><th>Vehicle</th><th>DCIR (mΩ)</th><th>Verdict</th></tr></thead><tbody>{failed.map(s=><tr key={s.Test_Name}><td>{getBikeNo(s.Test_Name)}</td><td>{s.Pack_DCIR_mOhm.toFixed(2)}</td><td style={{color:"#FF4B4B",fontWeight:700}}>FAIL</td></tr>)}</tbody></table></div></div></div>
                  </div>
               );
            })()}

            {activeTab === "test_repository" && (() => {
               const GOLDEN_BIKES_REPO = ["2025_10_22-07-BK", "2025_10_09-14-BK", "2025_10_25-09-BK (Nw-BB)", "2025_10_20-15-BK", "2025_10_19-17-BK", "2025_10_25-04-BK (Nw-BB)"];
               const isT = qcEnvMethod === "Tolerance (%)";
               const tKey = isT ? `_${qcTolerance}Pct` : "_2Sigma";

               // Golden power range
               const goldenPwrs = (summaries || []).filter(s => GOLDEN_BIKES_REPO.some(g => s.Test_Name?.includes(g))).map(s => Number(s.Power_Avg_120s || 0)).filter(p => p >= 19 && p <= 20.5);
               const mPwr = goldenPwrs.length ? goldenPwrs.reduce((a,b) => a+b, 0) / goldenPwrs.length : 19.5;
               const pUp = mPwr * 1.10, pLow = mPwr * 0.90;

               const getEnvRow = (ch) => {
                 const env = envelopes[ch]; if (!env || !env["Time (s)"]) return null;
                 // Use Number() on both sides to avoid 120 !== 120.0 type mismatch
                 const idx = env["Time (s)"].findIndex(t => Number(t) === Number(qcTimeS));
                 if (idx < 0) return null;
                 const row = {}; Object.keys(env).forEach(k => { row[k] = env[k][idx]; }); return row;
               };

               const activeChs = qcTarget.includes("All Data") ? ["IGBT","Motor","HighCell","AFE"] : ["IGBT","Motor","HighCell","AFE"].filter(ch => qcTarget.includes(ch));
               const showDtdt  = !qcMetric.includes("Power Based") && (qcMetric.includes("All Assessments") || qcMetric.includes("dT/dt"));
               const showDt    = !qcMetric.includes("Power Based") && (qcMetric.includes("All Assessments") || qcMetric.includes("dT"));
               const showPower = qcTarget.includes("All Data") || qcTarget.includes("Electrical Power") || qcMetric.includes("Power Based");

               const visibleCols = ["Test Name", "Type"];
               activeChs.forEach(ch => {
                 if (showDtdt) visibleCols.push(`${ch} dTdt`);
                 if (showDt)   visibleCols.push(`${ch} dT`);
               });
               if (showPower) visibleCols.push("Power Rating (kW)");
               visibleCols.push("Final Conclusion");

               const repoResults = (summaries || []).map(row => {
                 const testName  = row.Test_Name || "";
                 const bikeType  = row.Type || "Evaluation";
                 const bikePower = Number(row.Power_Avg_120s || 0);
                 const result    = { "Test Name": testName, "Type": bikeType, "Power Rating (kW)": bikePower };

                 // Use snapshot values at qcTimeS (60/120/180s) — matches Streamlit's merge_asof lookup
                 ["IGBT","Motor","HighCell","AFE"].forEach(ch => {
                   const dtdtKey = `${ch}_dTdt_${qcTimeS}s`;
                   const dtKey   = `${ch}_dT_${qcTimeS}s`;
                   result[`${ch} dTdt`] = Number(row[dtdtKey] ?? row[`${ch}_dTdt_Max`] ?? 0);
                   result[`${ch} dT`]   = Number(row[dtKey]   ?? row[`${ch}_dT_Max`]   ?? 0);
                 });

                 const failures = [];
                 // Streamlit parity: only skip dT/dTdt block when "Power Based" is the SOLE selection
                 const onlyPowerBased = qcMetric.length === 1 && qcMetric[0] === "Power Based";
                 if (qcMetric.length > 0 && !onlyPowerBased) {
                   ["IGBT","Motor","HighCell","AFE"].forEach(ch => {
                     if (!qcTarget.includes("All Data") && !qcTarget.includes(ch)) return;
                     const envRow = getEnvRow(ch); if (!envRow) return;
                     const upDtdt = Number(envRow[`dTdt_Upper${tKey}`] || 999);
                     const upDt   = Number(envRow[`dT_Upper${tKey}`]   || 999);
                     const valDtdt = result[`${ch} dTdt`];
                     const valDt   = result[`${ch} dT`];
                     if ((qcMetric.includes("All Assessments") || qcMetric.includes("dT/dt")) && valDtdt > upDtdt)
                       failures.push(`${ch} Rise Rate ${valDtdt.toFixed(3)} > ${upDtdt.toFixed(3)}°C/s`);
                     if ((qcMetric.includes("All Assessments") || qcMetric.includes("dT")) && valDt > upDt)
                       failures.push(`${ch} Cumm Rise ${valDt.toFixed(2)} > ${upDt.toFixed(2)}°C`);
                   });
                 }
                 if ((qcTarget.includes("All Data") || qcTarget.includes("Electrical Power")) && (qcMetric.includes("All Assessments") || qcMetric.includes("Power Based"))) {
                   if (!(pLow <= bikePower && bikePower <= pUp))
                     failures.push(`Power ${bikePower.toFixed(1)}kW outside ${pLow.toFixed(1)}–${pUp.toFixed(1)}kW`);
                 }

                 if (bikeType === "Golden Baseline") {
                   result["Final Conclusion"] = "PASS (Golden Base)";
                   result._pass = true;
                 } else {
                   result["Final Conclusion"] = failures.length ? `FAIL (${failures.join("; ")})` : "PASS";
                   result._pass = failures.length === 0;
                 }
                 return result;
               }).filter(r => !repoSearch || r["Test Name"].toLowerCase().includes(repoSearch.toLowerCase()));

               const pRes = repoResults.filter(r => r._pass);
               const fRes = repoResults.filter(r => !r._pass);

               const thS = { padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--text-sub)", borderBottom:"1px solid rgba(255,255,255,0.08)", whiteSpace:"nowrap", background:"var(--card-bg)" };
               const tdS = { padding:"7px 12px", fontSize:12, borderBottom:"1px solid rgba(255,255,255,0.05)", whiteSpace:"nowrap" };

               const RepoTable = ({ rows, accent }) => (
                 <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${accent}22`,marginBottom:24}}>
                   <table style={{width:"100%",borderCollapse:"collapse"}}>
                     <thead>
                       <tr>
                         {visibleCols.map(h => <th key={h} style={thS}>{h}</th>)}
                       </tr>
                     </thead>
                     <tbody>
                       {rows.length === 0
                         ? <tr><td colSpan={visibleCols.length} style={{...tdS, textAlign:"center", color:"var(--text-sub)", padding:20}}>No results</td></tr>
                         : rows.map((r,i) => (
                           <tr key={i} style={{background: i%2===0 ? "transparent" : "rgba(255,255,255,0.015)"}}>
                             {visibleCols.map(col => {
                               if (col === "Final Conclusion") return <td key={col} style={{...tdS, color: r._pass ? "#43B3AE" : "#FF4B4B", fontWeight:700, whiteSpace:"normal", maxWidth:340}}>{r[col]}</td>;
                               if (col === "Test Name") return <td key={col} style={{...tdS, fontFamily:"monospace", fontSize:11}}>{r[col]}</td>;
                               if (col === "Type")      return <td key={col} style={{...tdS, color:"var(--text-sub)"}}>{r[col]}</td>;
                               const v = r[col];
                               const decimals = col.includes("dTdt") ? 3 : 2;
                               return <td key={col} style={tdS}>{typeof v === "number" ? v.toFixed(decimals) : (v ?? "—")}</td>;
                             })}
                           </tr>
                         ))
                       }
                     </tbody>
                   </table>
                 </div>
               );

               const envCards = (label, colSuffix) => {
                 const dec = colSuffix === "dTdt" ? 3 : 2;
                 return (
                   <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
                     {["IGBT","Motor","HighCell","AFE"].map(ch => {
                       const e = getEnvRow(ch);
                       const up   = Number(e?.[`${colSuffix}_Upper${tKey}`] || 0);
                       const low  = Number(e?.[`${colSuffix}_Lower${tKey}`] || 0);
                       const mean = Number(e?.[`${colSuffix}_Mean`] || 0);
                       return (
                         <div key={ch} className="metric-card" style={{padding:"10px 14px",textAlign:"center"}}>
                           <div style={{fontSize:10,color:"var(--text-sub)",fontWeight:700,marginBottom:4,textTransform:"uppercase"}}>{ch} {label}</div>
                           <div style={{fontSize:13,fontWeight:800}}>
                             <span style={{color:"#43B3AE"}}>{up.toFixed(dec)}</span>
                             <span style={{color:"var(--text-sub)",margin:"0 4px"}}>|</span>
                             <span>{mean.toFixed(dec)}</span>
                             <span style={{color:"var(--text-sub)",margin:"0 4px"}}>|</span>
                             <span style={{color:"#43B3AE"}}>{low.toFixed(dec)}</span>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 );
               };

               return (
                 <div>
                   <div style={{fontSize:16,fontWeight:800,color:"var(--text-main)",marginBottom:16}}>📂 Test Repository — QC Evaluation</div>

                   <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12, position: "relative", zIndex: 20}}>
                     <div className="metric-card" style={{padding:12}}>
                       <div style={{fontSize:11,color:"var(--text-sub)",marginBottom:6,fontWeight:700}}>⏳ QC Timestamp</div>
                       <StreamlitSelect value={`${qcTimeS}s`} onChange={v => setQcTimeS(parseInt(v))} options={["60s","120s","180s"]} />
                     </div>
                     <div className="metric-card" style={{padding:12}}>
                       <div style={{fontSize:11,color:"var(--text-sub)",marginBottom:6,fontWeight:700}}>📏 Envelope Method</div>
                       <StreamlitSelect value={qcEnvMethod} onChange={setQcEnvMethod} options={["Tolerance (%)","Statistical (2-Sigma)"]} />
                     </div>
                     <div className="metric-card" style={{padding:12}}>
                       <div style={{fontSize:11,color:"var(--text-sub)",marginBottom:6,fontWeight:700}}>🎯 Target Channel</div>
                       <StreamlitMultiSelect value={qcTarget} onChange={setQcTarget} options={["All Data","IGBT","Motor","HighCell","AFE","Electrical Power"]} />
                     </div>
                     <div className="metric-card" style={{padding:12}}>
                       <div style={{fontSize:11,color:"var(--text-sub)",marginBottom:6,fontWeight:700}}>📉 Assessment Metric</div>
                       <StreamlitMultiSelect value={qcMetric} onChange={setQcMetric} options={["All Assessments","dT/dt","dT","Power Based"]} />
                     </div>
                   </div>

                   <div style={{display:"flex",gap:12,marginBottom:20,alignItems:"center",flexWrap:"wrap"}}>
                     {isT && <div className="metric-card" style={{padding:"8px 14px",display:"flex",alignItems:"center",gap:10}}>
                       <span style={{fontSize:12,color:"var(--text-sub)",fontWeight:700}}>Tolerance:</span>
                       {[5,10,15,20].map(t => (
                         <button key={t} onClick={() => setQcTolerance(t)} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${qcTolerance===t?"#43B3AE":"rgba(255,255,255,0.1)"}`,background:qcTolerance===t?"rgba(67,179,174,0.15)":"transparent",color:qcTolerance===t?"#43B3AE":"var(--text-sub)",cursor:"pointer",fontWeight:700,fontSize:12}}>±{t}%</button>
                       ))}
                     </div>}
                     <div style={{flex:1,minWidth:200}} className="metric-card">
                       <input value={repoSearch} onChange={e => setRepoSearch(e.target.value)} placeholder="🔍 Filter by test name…" style={{width:"100%",background:"transparent",border:"none",outline:"none",color:"var(--text-main)",fontSize:13,padding:"8px 14px"}} />
                     </div>
                   </div>

                   {/* Golden Criteria */}
                   <div style={{marginBottom:24}}>
                     <div style={{fontSize:13,fontWeight:800,color:"#FFD700",marginBottom:10}}>👑 Master Golden Criteria @ {qcTimeS/60} min ({qcTimeS}s)</div>
                     <div style={{background:"var(--card-bg)",border:"1px solid rgba(255,215,0,0.2)",borderLeft:"4px solid #FFD700",borderRadius:12,padding:"12px 18px",marginBottom:12}}>
                       <div style={{fontSize:11,color:"var(--text-sub)",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>⚡ Electrical Power Validation (0s to 120s)</div>
                       <div style={{fontSize:18,fontWeight:800}}><span style={{color:"#43B3AE"}}>{pUp.toFixed(2)} kW</span><span style={{color:"var(--text-sub)",margin:"0 8px"}}>|</span><span>{mPwr.toFixed(2)} kW</span><span style={{color:"var(--text-sub)",margin:"0 8px"}}>|</span><span style={{color:"#43B3AE"}}>{pLow.toFixed(2)} kW</span></div>
                     </div>
                     {envCards("Rise Rate (°C/s)","dTdt")}
                     {envCards("Cumulative Rise (°C)","dT")}
                   </div>

                   {/* Summary counts */}
                   <div style={{display:"flex",gap:12,marginBottom:16}}>
                     <div style={{background:"rgba(67,179,174,0.1)",border:"1px solid rgba(67,179,174,0.25)",borderRadius:8,padding:"8px 18px",fontWeight:800,color:"#43B3AE",fontSize:13}}>✅ PASS: {pRes.length}</div>
                     <div style={{background:"rgba(255,75,75,0.1)",border:"1px solid rgba(255,75,75,0.25)",borderRadius:8,padding:"8px 18px",fontWeight:800,color:"#FF4B4B",fontSize:13}}>❌ FAIL: {fRes.length}</div>
                     <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 18px",fontWeight:700,color:"var(--text-sub)",fontSize:13}}>Total: {repoResults.length}</div>
                   </div>

                   {/* PASS table */}
                   <div style={{fontSize:13,fontWeight:800,color:"#43B3AE",marginBottom:8,display:"flex",alignItems:"center",gap:8}}><ClipboardList size={16}/> Passed Tests ({pRes.length})</div>
                   <RepoTable rows={pRes} accent="#43B3AE" />

                   {/* FAIL table */}
                   <div style={{fontSize:13,fontWeight:800,color:"#FF4B4B",marginBottom:8,display:"flex",alignItems:"center",gap:8}}><XCircle size={16}/> Failed Tests ({fRes.length})</div>
                   <RepoTable rows={fRes} accent="#FF4B4B" />
                 </div>
               );
            })()}

            {activeTab === "fleet_registry" && (() => {
              const allBikes = Object.keys(fleetData || {});
              const visibleBikes = allBikes.filter((b) => searchBikes.includes("All Vehicles") || searchBikes.includes(b));
              const selectedBikeNum = selectedBike ? selectedBike.split("-")[1]?.replace(/^0+/, "") : null;
              const bikeTests = selectedBikeNum ? summaries.filter((s) => getBikeNo(s.Test_Name) === selectedBikeNum) : [];
              const selectedFleet = selectedBike ? (fleetData[selectedBike] || {}) : {};

              const qcVerdict = (() => {
                if (!selectedBike || !historicalTest || !historicalTelemetry) return null;
                const testRow = bikeTests.find((row) => row.Test_Name === historicalTest);
                if (!testRow) return null;

                const bikePower = Number(testRow.Power_Avg_120s || 0);
                const goldenPowers = summaries
                  .filter((r) => GOLDEN_BIKES.some((gold) => r.Test_Name?.includes(gold)))
                  .map((r) => Number(r.Power_Avg_120s || 0))
                  .filter((p) => p >= 19 && p <= 20.5);
                const mgp = goldenPowers.length ? goldenPowers.reduce((a, b) => a + b, 0) / goldenPowers.length : 19.5;
                const pUp = mgp * 1.1;
                const pDn = mgp * 0.9;
                const failures = [];
                let passed = true;

                const times = historicalTelemetry["Time (s)"] || [];
                const nearestIndex = times.reduce((bestIdx, t, idx) => {
                  if (bestIdx === -1) return idx;
                  return Math.abs(t - 120) < Math.abs(times[bestIdx] - 120) ? idx : bestIdx;
                }, -1);

                ["IGBT", "Motor", "HighCell", "AFE"].forEach((ch) => {
                  const env = envelopes[ch];
                  let envRow = null;
                  if (env && env["Time (s)"]) {
                    const idx = env["Time (s)"].findIndex(t => Number(t) === 120);
                    if (idx >= 0) {
                      envRow = {};
                      Object.keys(env).forEach(k => { envRow[k] = env[k][idx]; });
                    }
                  }
                  if (!envRow || nearestIndex < 0) return;

                  const dtdtKey = ch === "AFE" ? "AFE_Mean_dTdt" : `${ch}_dTdt`;
                  const dtKey = ch === "AFE" ? "AFE_Mean_dT" : `${ch}_dT`;
                  const valDtdt = Number((historicalTelemetry[dtdtKey] || [])[nearestIndex] || 0);
                  const valDt = Number((historicalTelemetry[dtKey] || [])[nearestIndex] || 0);
                  const upDtdt = Number(envRow["dTdt_Upper_20Pct"] || 999);
                  const upDt = Number(envRow["dT_Upper_20Pct"] || 999);

                  if (valDtdt > upDtdt) {
                    passed = false;
                    failures.push(`${ch} Rise Rate ${valDtdt.toFixed(3)} > ${upDtdt.toFixed(3)}°C/s`);
                  }
                  if (valDt > upDt) {
                    passed = false;
                    failures.push(`${ch} Cumm Rise ${valDt.toFixed(2)} > ${upDt.toFixed(2)}°C`);
                  }
                });

                if (!(pDn <= bikePower && bikePower <= pUp)) {
                  passed = false;
                  failures.push(`Power ${bikePower.toFixed(1)}kW outside ${pDn.toFixed(1)}–${pUp.toFixed(1)}kW`);
                }

                if (String(testRow.Type || "").includes("Golden")) {
                  return {
                    icon: "👑",
                    title: "Golden Reference Vehicle",
                    detail: "Automated pass (Golden Reference Vehicle)",
                    color: "#FFD700",
                    background: "rgba(255,215,0,0.15)",
                    borderLeft: "4px solid #FFD700"
                  };
                }

                return {
                  icon: passed ? "✅" : "❌",
                  title: passed ? "PASS" : "FAIL",
                  detail: passed ? "" : `Failed Rules: ${failures.join(", ")}`,
                  color: passed ? "#43B3AE" : "#FF4B4B",
                  background: passed ? "rgba(67,179,174,0.15)" : "rgba(255,75,75,0.15)",
                  borderLeft: passed ? "4px solid #43B3AE" : "4px solid #FF4B4B"
                };
              })();

              // --- helpers ---
              const STATUS_COLOR = { "Active": "#43B3AE", "In-Service": "#FFA15A", "Offline": "#8A8A93", "Retired": "#FF4B4B" };
              const HW_FIELDS = ["battery_box_id","motor_id","left_module_id","right_module_id","bms_id","aux_battery_id","vin"];
              const getCompleteness = (d) => HW_FIELDS.filter(f => d[f] && d[f] !== "N/A" && d[f] !== "UNASSIGNED" && d[f] !== "NVA5P1.PTP0011").length;

              if (!selectedBike) {
                return (
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-main)", marginBottom: 16 }}>Fleet Hardware Registry</div>
                    <div style={{ marginBottom: 20 }}>
                      <StreamlitMultiSelect value={searchBikes} onChange={setSearchBikes} options={["All Vehicles", ...allBikes]} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                      {visibleBikes.map((bikeId) => {
                        const bikeNum = bikeId.split("-")[1]?.replace(/^0+/, "");
                        const testsDone = summaries.filter((s) => getBikeNo(s.Test_Name) === bikeNum).length;
                        const bData = fleetData[bikeId] || {};
                        const filled = getCompleteness(bData);
                        const subtitle = bData.vin && bData.vin !== "NVA5P1.PTP0011" ? bData.vin : bData.battery_box_id || "—";
                        const hasGap = filled < HW_FIELDS.length;
                        return (
                          <div key={bikeId}>
                            <div className="fleet-card" style={{ position: "relative" }}>
                              {/* Missing data warning */}
                              {hasGap && <div style={{ position: "absolute", top: 12, left: 12, color: "#FFA15A", fontSize: 11 }} title={`${filled}/${HW_FIELDS.length} fields populated`}>⚠️</div>}
                              <div className="fleet-icon" style={{ marginTop: hasGap ? 8 : 0 }}><Bike size={32} /></div>
                              <div className="fleet-vin">{bikeId}</div>
                              <div className="fleet-id" style={{ fontSize: 11, marginBottom: 4, fontFamily: "monospace" }}>{subtitle}</div>
                              {/* Completeness bar */}
                              <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 6, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${(filled / HW_FIELDS.length) * 100}%`, background: filled === HW_FIELDS.length ? "#43B3AE" : "#FFA15A", borderRadius: 2, transition: "width 0.4s" }} />
                              </div>
                              <div className="fleet-id">{testsDone} Dyno Tests • {filled}/{HW_FIELDS.length} fields</div>

                            </div>
                            <button
                              onClick={() => {
                                setSelectedBike(bikeId);
                                const firstTest = summaries.filter((s) => getBikeNo(s.Test_Name) === bikeNum).sort((a, b) => String(b.Test_Name).localeCompare(String(a.Test_Name)))[0];
                                if (firstTest) setHistoricalTest(firstTest.Test_Name);
                                else setHistoricalTest("");
                              }}
                              style={{ width: "100%", marginTop: -4, padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#FFF", fontWeight: 700, cursor: "pointer" }}
                            >
                              Analyze Hardware
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // --- Detail view ---
              const filled = getCompleteness(selectedFleet);
              const filledPct = Math.round((filled / HW_FIELDS.length) * 100);

              // Pass/fail history for all bike tests
              const verdictHistory = bikeTests.map(t => {
                const bp = Number(t.Power_Avg_120s || 0);
                const goldenPwrs = summaries.filter(r => GOLDEN_BIKES.some(g => r.Test_Name?.includes(g))).map(r => Number(r.Power_Avg_120s || 0)).filter(p => p >= 19 && p <= 20.5);
                const mgp = goldenPwrs.length ? goldenPwrs.reduce((a,b)=>a+b,0)/goldenPwrs.length : 19.5;
                const pwrOk = bp >= mgp * 0.9 && bp <= mgp * 1.1;
                const isGolden = String(t.Type||"").includes("Golden");
                return { name: t.Test_Name, pass: isGolden || pwrOk, golden: isGolden };
              }).sort((a,b) => String(a.name).localeCompare(String(b.name)));

              return (
                <div>
                  <button onClick={() => setSelectedBike(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#43B3AE", cursor: "pointer", marginBottom: 16, fontWeight: 700 }}><ChevronLeft size={16} /> Back to Fleet</button>

                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: 28, fontWeight: 900, color: "#FFF", margin: 0 }}>{selectedBike}</h2>
                    {/* Inline edit button — jumps to Data Engine Manual Entry pre-filled */}
                    <button onClick={() => { setPlmBikeNo(Number(selectedBike.split("-")[1])); setPlmTab("manual"); setActiveTab("data_engine"); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "var(--text-sub)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      ✏️ Edit Hardware
                    </button>
                  </div>
                  {selectedFleet.vin && selectedFleet.vin !== "NVA5P1.PTP0011" && (
                    <div style={{ fontSize: 13, color: "#43B3AE", marginBottom: 12, fontFamily: "monospace" }}>VIN: {selectedFleet.vin}</div>
                  )}

                  {/* Completeness score — #5 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "10px 16px" }}>
                    <div style={{ fontSize: 12, color: "var(--text-sub)", fontWeight: 700, whiteSpace: "nowrap" }}>Hardware Profile</div>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${filledPct}%`, background: filledPct === 100 ? "#43B3AE" : "#FFA15A", borderRadius: 3, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: filledPct === 100 ? "#43B3AE" : "#FFA15A", whiteSpace: "nowrap" }}>{filled}/{HW_FIELDS.length} fields · {filledPct}%</div>
                  </div>

                  {/* Hardware fields */}
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#FFF", marginBottom: 16 }}>Hardware Registry Details</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 30 }}>
                    {[
                      { label: "Tests Evaluated", value: bikeTests.length, accent: true },
                      { label: "Battery Box ID",  value: selectedFleet.battery_box_id },
                      { label: "Left Module ID",  value: selectedFleet.left_module_id },
                      { label: "Right Module ID", value: selectedFleet.right_module_id },
                      { label: "BMS ID",          value: selectedFleet.bms_id },
                      { label: "Motor ID",        value: selectedFleet.motor_id },
                      { label: "Aux Battery ID",  value: selectedFleet.aux_battery_id },
                      ...(selectedFleet.powertrain_id ? [{ label: "Powertrain ID", value: selectedFleet.powertrain_id }] : []),
                    ].map(({ label, value, accent }) => (
                      <div key={label} className="hw-box" style={{ background: accent ? "rgba(67,179,174,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${accent ? "rgba(67,179,174,0.15)" : "rgba(255,255,255,0.08)"}`, position: "relative", cursor: value && value !== "N/A" ? "pointer" : "default" }}
                        title={value && value !== "N/A" ? "Click to copy" : ""}
                        onClick={() => { if (value && value !== "N/A") navigator.clipboard?.writeText(String(value)); }}>
                        <div className="hw-label" style={accent ? { color: "#43B3AE" } : {}}>{label}</div>
                        <div className="hw-value" style={{ color: value && value !== "N/A" ? "#fff" : "#555" }}>{value || "N/A"}</div>
                      </div>
                    ))}
                  </div>

                  {/* Pass/Fail history timeline — #12 */}
                  {verdictHistory.length > 0 && (
                    <div style={{ marginBottom: 30 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#FFF", marginBottom: 10 }}>Test History</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {verdictHistory.map(v => (
                          <div key={v.name}
                            onClick={() => setHistoricalTest(v.name)}
                            title={v.name}
                            style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: v.golden ? "rgba(255,215,0,0.12)" : v.pass ? "rgba(67,179,174,0.12)" : "rgba(255,75,75,0.12)",
                              border: `1px solid ${v.golden ? "#FFD70055" : v.pass ? "#43B3AE55" : "#FF4B4B55"}`,
                              color: v.golden ? "#FFD700" : v.pass ? "#43B3AE" : "#FF4B4B",
                              outline: historicalTest === v.name ? `2px solid ${v.golden ? "#FFD700" : v.pass ? "#43B3AE" : "#FF4B4B"}` : "none" }}>
                            {v.golden ? "👑" : v.pass ? "✅" : "❌"} {v.name.split("-").slice(-1)[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 30, position: "relative", zIndex: 10 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#FFF", marginBottom: 16 }}>Historical Test Inspection</div>
                    {bikeTests.length === 0 ? (
                      <div style={{ padding: "20px", color: "var(--text-sub)", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.1)" }}>
                        ⚠️ No historical tests logged for {selectedBike}
                      </div>
                    ) : (
                      <>
                        <div style={{ maxWidth: 420, marginBottom: 20 }}>
                          <StreamlitSelect value={historicalTest} onChange={setHistoricalTest} options={bikeTests.map((s) => s.Test_Name).sort((a, b) => String(b).localeCompare(String(a)))} />
                        </div>
                        {historicalTelemetry && (() => {
                            const keys = Object.keys(historicalTelemetry);
                            const htCol  = keys.find(c => c === "highest_temp (oC)") || keys.find(c => c.toLowerCase().includes("highcell")) || "HighCell_Temp";
                            const igbtCol  = keys.find(c => c.toLowerCase().includes("igbt"))  || "IGBT_Temp";
                            const motorCol = keys.find(c => c.toLowerCase().includes("motor")) || "Motor_Temp";
                            const afeCol   = keys.find(c => c.toLowerCase().includes("afe_mean") || c.toLowerCase().includes("afe_temp")) || keys.find(c => c.toLowerCase().includes("afe"));
                            const timeArr  = historicalTelemetry["Time (s)"] || [];
                            // Snapshot marker shapes at 60/120/180s
                            const snapshotShapes = [60, 120, 180].map(t => ({
                              type: "line", x0: t, x1: t, y0: 0, y1: 1, yref: "paper",
                              line: { color: "rgba(255,161,90,0.4)", width: 1, dash: "dot" }
                            }));
                            const snapshotAnnotations = [60, 120, 180].map(t => ({
                              x: t, y: 1, yref: "paper", text: `${t}s`, showarrow: false,
                              font: { size: 9, color: "#FFA15A" }, xanchor: "center", yanchor: "bottom"
                            }));
                            return (
                              <div className="metric-card" style={{ padding: 16, marginBottom: 20 }}>
                                <div style={{ fontWeight: 700, marginBottom: 12 }}>Thermal Profile — {historicalTest}</div>
                                <Plot data={[
                                  historicalTelemetry[htCol]   ? { x: timeArr, y: historicalTelemetry[htCol],   name: "HighCell",  line: { color: "#FF4B4B", width: 2 } } : null,
                                  historicalTelemetry[igbtCol]  ? { x: timeArr, y: historicalTelemetry[igbtCol],  name: "IGBT",      yaxis: "y2", line: { color: "#43B3AE", width: 2 } } : null,
                                  historicalTelemetry[motorCol] ? { x: timeArr, y: historicalTelemetry[motorCol], name: "Motor",     yaxis: "y2", line: { color: "cyan", width: 2 } } : null,
                                  afeCol && historicalTelemetry[afeCol] ? { x: timeArr, y: historicalTelemetry[afeCol], name: "AFE", yaxis: "y2", line: { color: "#FFA15A", width: 1.5, dash: "dot" } } : null,
                                ].filter(Boolean)}
                                layout={{ ...DARK_TOOLTIP, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#A0A0AB", size: 10 }, height: 500, hovermode: "x unified", margin: { t: 30, b: 10, l: 10, r: 10 }, legend: { orientation: "h", y: 1.02, x: 1, xanchor: "right", yanchor: "bottom" }, shapes: snapshotShapes, annotations: snapshotAnnotations, xaxis: { title: "Time (s)", showgrid: false, zeroline: false }, yaxis: { title: "HighCell Temp (°C)", showgrid: true, gridcolor: "rgba(128,128,128,0.2)", zeroline: false }, yaxis2: { title: "Powertrain Temp (°C)", overlaying: "y", side: "right", showgrid: false, zeroline: false } }}
                                config={{ responsive: true, displaylogo: false }} style={{ width: "100%" }} />
                              </div>
                            );
                        })()}
                        {qcVerdict && <div><div style={{ fontWeight: 800, color: "#FFF", marginBottom: 10 }}>QC Verdict (120s @ 20% Tolerance)</div><div style={{ background: qcVerdict.background, borderLeft: qcVerdict.borderLeft, padding: 15, borderRadius: 8 }}><div style={{ color: qcVerdict.color, fontSize: "1.2rem", fontWeight: 800 }}>{qcVerdict.icon} {qcVerdict.title}</div>{qcVerdict.detail && <div style={{ fontSize: "0.9rem", color: "#A0A0AB", marginTop: 4 }}>{qcVerdict.detail}</div>}</div></div>}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}


            {activeTab === "data_engine" && (
          <div style={{ paddingBottom: 40 }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 20, color: "#FFF" }}>Data Engine</h2>

            <div style={{ background: "rgba(55,140,255,0.1)", border: "1px solid rgba(55,140,255,0.3)", padding: "12px 16px", borderRadius: 8, marginBottom: 30, fontSize: 13, color: "#A0C8FF", display: "flex", alignItems: "center", gap: 10 }}>
              💡 <b>Active Golden Standard:</b> The Engine uses these bikes to build the Statistical Envelope: {GOLDEN_BIKES_STR}.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 30 }}>
              {/* Upload */}
              <div>
                <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <span style={{ background: "#55AAFF", color: "#000", width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold" }}>1</span>
                  Upload Raw Data
                </h3>
                <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 12 }}>Select Test Type</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {["Evaluation (Test)", "Baseline (Calibration)"].map(mode => (
                    <label key={mode} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", cursor: "pointer", fontSize: 14 }}>
                      <input type="radio" name="deUploadMode" checked={deUploadMode === mode} onChange={() => setDeUploadMode(mode)} style={{ accentColor: "#43B3AE" }} />
                      {mode}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 8 }}>Drop .xlsx file(s) here</div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDeIsHovering(true); }}
                  onDragLeave={() => setDeIsHovering(false)}
                  onDrop={(e) => { e.preventDefault(); setDeIsHovering(false); deHandleFilesAdded(e.dataTransfer.files); }}
                  style={{ border: deIsHovering ? "2px dashed #43B3AE" : "1px dashed rgba(255,255,255,0.2)", background: deIsHovering ? "rgba(67,179,174,0.05)" : "var(--card-bg)", borderRadius: 12, padding: "30px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                    <UploadCloud size={30} color={deIsHovering ? "#43B3AE" : "var(--text-title)"} />
                    <div>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Drag and drop files here</div>
                      <div style={{ color: "var(--text-sub)", fontSize: 12 }}>Limit 200MB per file • XLSX</div>
                    </div>
                  </div>
                  <button onClick={() => deFileInputRef.current?.click()} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Browse files</button>
                  <input type="file" multiple accept=".xlsx" ref={deFileInputRef} style={{ display: "none" }} onChange={(e) => deHandleFilesAdded(e.target.files)} />
                </div>
                {deFiles.length > 0 && (
                  <div style={{ marginTop: 15 }}>
                    {deFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", padding: "6px 12px", borderRadius: 6, marginBottom: 8, fontSize: 13, color: "#fff" }}>
                        <File size={14} color="#55AAFF" /> {f.name}
                      </div>
                    ))}
                    <button onClick={deUploadFiles} style={{ width: "100%", background: "#43B3AE", color: "#000", border: "none", padding: "10px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", marginTop: 10 }}>
                      Confirm Upload
                    </button>
                  </div>
                )}
              </div>

              {/* Engine Controls & Logs */}
              <div>
                <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                  <span style={{ background: "#55AAFF", color: "#000", width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold" }}>2</span>
                  Engine Controls
                </h3>
                <button onClick={deRunProcessing} disabled={deIsProcessing}
                  style={{ width: "50%", padding: "12px 20px", background: "linear-gradient(90deg, #43B3AE, #3B9F9A)", color: "#000", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 14, cursor: deIsProcessing ? "not-allowed" : "pointer", opacity: deIsProcessing ? 0.7 : 1, boxShadow: "0 8px 20px rgba(67,179,174,0.3)" }}>
                  {deIsProcessing ? "Processing..." : "⚙️ Run Processing & DB Sync"}
                </button>
                <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20 }}>
                  <a href={`${API}/api/dyno/export_db`} download="raptee_dyno.db" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "linear-gradient(90deg, #43B3AE, #3B9F9A)", border: "none", borderRadius: 8, cursor: "pointer", color: "#000", fontSize: 14, fontWeight: 800, textDecoration: "none", marginBottom: 12 }}>
                    <Download size={16} /> Download Master SQLite DB
                  </a>
                  <div onClick={deHandleReset} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, cursor: "pointer", color: "var(--text-sub)", fontSize: 14, transition: "0.2s" }}
                    onMouseEnter={(e) => e.currentTarget.style.border = "1px solid #FF4B4B"}
                    onMouseLeave={(e) => e.currentTarget.style.border = "1px solid rgba(255,255,255,0.05)"}>
                    <Trash2 size={16} /> <b>Factory Reset Database</b>
                  </div>
                </div>
                <div style={{ marginTop: 40 }}>
                  <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 15 }}>
                    <Terminal size={20} color="#FFA15A" /> System Processing Logs
                  </h3>
                  <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>Live Terminal Output:</div>
                  <div ref={deLogRef} style={{ background: "#0E0E11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "16px", height: 200, overflowY: "auto", fontFamily: "monospace", fontSize: 13, color: "#43B3AE", whiteSpace: "pre-wrap", boxShadow: "inset 0 4px 20px rgba(0,0,0,0.5)" }}>
                    {deLogs || "Waiting for operations..."}
                  </div>
                </div>
              </div>
            </div>

            {/* PLM Hardware Registry */}
            <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 30 }}>
              <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ background: "#55AAFF", color: "#000", width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold" }}>3</span>
                PLM Hardware Registry
              </h3>
              <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 16 }}>Update the Digital Twin registry. Existing fields are never overwritten with blank values.</div>

              {/* Tab switcher */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 4, width: "fit-content" }}>
                {[["bulk","📂 Bulk Upload"],["manual","✏️ Manual Entry"]].map(([id, label]) => (
                  <button key={id} onClick={() => { setPlmTab(id); setPlmStatus(null); }}
                    style={{ padding: "7px 18px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                      background: plmTab === id ? "#55AAFF" : "transparent",
                      color: plmTab === id ? "#000" : "var(--text-sub)" }}>
                    {label}
                  </button>
                ))}
              </div>

              {plmStatus && (
                <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600,
                  background: plmStatus.ok ? "rgba(67,179,174,0.1)" : "rgba(255,75,75,0.1)",
                  border: `1px solid ${plmStatus.ok ? "rgba(67,179,174,0.3)" : "rgba(255,75,75,0.3)"}`,
                  color: plmStatus.ok ? "#43B3AE" : "#FF4B4B" }}>
                  {plmStatus.ok ? "✅" : "❌"} {plmStatus.msg}
                </div>
              )}

              {plmTab === "bulk" && (
                <div style={{ maxWidth: 560 }}>
                  <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 8 }}>Drop hardware manifest (.csv or .xlsx)</div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setPlmIsHovering(true); }}
                    onDragLeave={() => setPlmIsHovering(false)}
                    onDrop={(e) => { e.preventDefault(); setPlmIsHovering(false); plmHandleFileDrop(e.dataTransfer.files); }}
                    style={{ border: plmIsHovering ? "2px dashed #55AAFF" : "1px dashed rgba(255,255,255,0.2)", background: plmIsHovering ? "rgba(85,170,255,0.05)" : "var(--card-bg)", borderRadius: 12, padding: "28px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <UploadCloud size={28} color={plmIsHovering ? "#55AAFF" : "var(--text-title)"} />
                      <div>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{plmFile ? plmFile.name : "Drag and drop file here"}</div>
                        <div style={{ color: "var(--text-sub)", fontSize: 12 }}>Accepts .csv or .xlsx</div>
                      </div>
                    </div>
                    <button onClick={() => plmFileInputRef.current?.click()} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Browse</button>
                    <input type="file" accept=".csv,.xlsx" ref={plmFileInputRef} style={{ display: "none" }} onChange={(e) => plmHandleFileDrop(e.target.files)} />
                  </div>
                  <button onClick={plmUploadManifest} disabled={!plmFile || plmUploading}
                    style={{ padding: "10px 24px", background: plmFile ? "linear-gradient(90deg,#55AAFF,#3B8FE0)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, color: plmFile ? "#000" : "var(--text-sub)", fontWeight: 700, fontSize: 13, cursor: plmFile ? "pointer" : "not-allowed" }}>
                    {plmUploading ? "Merging..." : "📥 Merge into Registry"}
                  </button>
                </div>
              )}

              {plmTab === "manual" && (() => {
                const existingKey = `BIKE-${plmBikeNo}`;
                const isExisting = !!fleetData[existingKey];
                const FIELD_DEFS = [
                  { key: "vin",             label: "VIN",             placeholder: "P5KTAAACA6MP00019" },
                  { key: "battery_box_id",  label: "Battery Box ID",  placeholder: "BB5k2601A00001" },
                  { key: "motor_id",        label: "Motor ID",        placeholder: "NVA5P1.PTP0011/A2504200000064" },
                  { key: "aux_battery_id",  label: "Aux Battery ID",  placeholder: "BAH0211Y319886" },
                  { key: "left_module_id",  label: "Left Module ID",  placeholder: "LH251100001" },
                  { key: "right_module_id", label: "Right Module ID", placeholder: "RH251100001" },
                  { key: "bms_id",          label: "BMS ID",          placeholder: "BMS260100001" },
                ];
                const inputStyle = { width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#fff", fontSize: 13, boxSizing: "border-box" };
                const labelStyle = { fontSize: 11, color: "var(--text-sub)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, display: "block" };
                return (
                  <div style={{ maxWidth: 700 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                      <div>
                        <label style={labelStyle}>Bike Number</label>
                        <input type="number" min={1} max={999} value={plmBikeNo}
                          onChange={(e) => setPlmBikeNo(Number(e.target.value))}
                          style={{ ...inputStyle, width: 120 }} />
                      </div>
                      <div style={{ marginTop: 18, fontSize: 13, color: isExisting ? "#43B3AE" : "#FFA15A", fontWeight: 600 }}>
                        {isExisting ? `✅ BIKE-${plmBikeNo} (existing)` : `⚡ BIKE-${plmBikeNo} (new bike)`}
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 16 }}>
                      {FIELD_DEFS.map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label style={labelStyle}>{label}</label>
                          <input type="text" value={plmFields[key]} placeholder={placeholder}
                            onChange={(e) => setPlmFields(p => ({ ...p, [key]: e.target.value }))}
                            style={inputStyle} />
                        </div>
                      ))}
                      <div>
                        <label style={labelStyle}>Status</label>
                        <select value={plmFields.status} onChange={(e) => setPlmFields(p => ({ ...p, status: e.target.value }))}
                          style={{ ...inputStyle, cursor: "pointer" }}>
                          {["Active","Offline","In-Service","Retired"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-sub)", marginBottom: 12 }}>Leave any field blank to keep existing value.</div>
                    <button onClick={plmSaveManual} disabled={plmSaving}
                      style={{ padding: "10px 24px", background: "linear-gradient(90deg,#55AAFF,#3B8FE0)", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, fontSize: 13, cursor: plmSaving ? "not-allowed" : "pointer", opacity: plmSaving ? 0.7 : 1 }}>
                      {plmSaving ? "Saving..." : "💾 Save to Registry"}
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Developer Access */}
            <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 30 }}>
              <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 15 }}>
                <Lock size={20} color="#FF4B4B" /> Developer Access: Test Management
              </h3>
              {!deDevUnlocked ? (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input type="password" value={dePassword} onChange={(e) => setDePassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && deHandlePasswordSubmit()}
                    placeholder="Enter Developer Password"
                    style={{ flex: 1, maxWidth: 350, padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#FFF", fontSize: 14 }} />
                  <button onClick={deHandlePasswordSubmit} style={{ padding: "12px 20px", background: "rgba(255,75,75,0.15)", border: "1px solid rgba(255,75,75,0.3)", color: "#FF4B4B", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                    Unlock
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background: "rgba(67,179,174,0.08)", border: "1px solid rgba(67,179,174,0.2)", padding: "10px 16px", borderRadius: 8, color: "#43B3AE", fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
                    ✅ Access Granted: Developer Mode Unlocked
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <XCircle size={18} color="#FF4B4B" /> Delete Specific Test
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <StreamlitSelect value={deDelTest} onChange={setDeDelTest} options={deProcessedTests.map(t => t.Test_Name)} placeholder="Select test to delete" />
                      </div>
                      <button onClick={deHandleDeleteTest} style={{ padding: "10px 20px", background: "rgba(255,75,75,0.15)", border: "1px solid rgba(255,75,75,0.3)", color: "#FF4B4B", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        🗑️ Delete Selected Test
                      </button>
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <Star size={18} color="#FFD700" /> Promote to Golden Baseline
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 12, padding: "8px 12px", background: "rgba(55,140,255,0.1)", border: "1px solid rgba(55,140,255,0.2)", borderRadius: 6 }}>
                        Moves an evaluated test into the Calibration folder to widen the statistical envelope.
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <StreamlitSelect value={dePromoTest} onChange={setDePromoTest} options={deProcessedTests.map(t => t.Test_Name)} placeholder="Select test to promote" />
                      </div>
                      <button onClick={deHandlePromoteTest} style={{ padding: "10px 20px", background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                        ⭐ Promote & Reprocess
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}


