"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { UploadCloud, File, Trash, Terminal, Lock, XCircle, Star, Download } from "lucide-react";
import DynoSidebar from "../components/DynoSidebar";
import StreamlitSelect from "../components/StreamlitSelect";

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8001";
const DEV_PASSWORD = "test@123";

export default function DataEnginePage() {
  const [uploadMode, setUploadMode] = useState("Evaluation (Test)");
  const [isHovering, setIsHovering] = useState(false);
  const [files, setFiles] = useState([]);
  const [logs, setLogs] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [password, setPassword] = useState("");
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [processedTests, setProcessedTests] = useState([]);
  const [delTest, setDelTest] = useState("");
  const [promoTest, setPromoTest] = useState("");
  const fileInputRef = useRef(null);
  const logRef = useRef(null);

  const goldenBikes = "2025_10_22-07-BK, 2025_10_09-14-BK, 2025_10_25-09-BK (Nw-BB), 2025_10_20-15-BK, 2025_10_19-17-BK, 2025_10_25-04-BK (Nw-BB)";

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Load processed tests for dev panel
  const loadProcessedTests = async () => {
    try {
      const res = await axios.get(`${API}/api/dyno/processed_tests`);
      const tests = Array.isArray(res.data) ? res.data : [];
      setProcessedTests(tests);
      if (tests.length > 0) {
        setDelTest(tests[0].Test_Name);
        setPromoTest(tests[0].Test_Name);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (devUnlocked) loadProcessedTests();
  }, [devUnlocked]);

  const handleDragOver = (e) => { e.preventDefault(); setIsHovering(true); };
  const handleDragLeave = () => setIsHovering(false);
  const handleDrop = (e) => { e.preventDefault(); setIsHovering(false); handleFilesAdded(e.dataTransfer.files); };

  const handleFilesAdded = (fileList) => {
    const newFiles = Array.from(fileList).filter(f => f.name.endsWith('.xlsx'));
    setFiles(prev => [...prev, ...newFiles]);
    appendLog(newFiles.length > 0 ? `Queued ${newFiles.length} file(s) for ${uploadMode}.` : `Error: Please upload .xlsx files only.`);
  };

  const appendLog = (msg) => setLogs(prev => prev + `> ${msg}\n`);

  const uploadFiles = async () => {
    if (files.length === 0) return;
    appendLog(`Starting upload sequence for ${files.length} file(s)...`);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", uploadMode);
      try {
        await axios.post(`${API}/api/dyno/upload`, formData, { headers: { "Content-Type": "multipart/form-data" } });
        appendLog(`✅ Uploaded: ${file.name}`);
      } catch (e) { appendLog(`❌ Failed to upload ${file.name}: ${e.message}`); }
    }
    setFiles([]);
    appendLog(`Upload sequence complete.`);
  };

  const runProcessing = async () => {
    setIsProcessing(true);
    appendLog("--- Initiating Core Processing Engine ---");
    try {
      const res = await axios.post(`${API}/api/dyno/process`);
      if (res.data.logs) setLogs(prev => prev + res.data.logs + "\n");
      if (res.data.error) appendLog(`[ERROR]: ${res.data.error}`);
      else appendLog(`✅ Processing complete. Synchronized ${res.data.result?.Processed || 0} files.`);
    } catch (e) { appendLog(`[FATAL]: Cannot connect to Engine Backend. (${e.message})`); }
    setIsProcessing(false);
  };

  const handleReset = async () => {
    if (confirm("WARNING: This will wipe out the entire DB and processed files. Are you sure?")) {
      try {
        await axios.post(`${API}/api/dyno/reset`);
        appendLog("⚠️ FACTORY RESET COMPLETE. Database has been wiped.");
        setProcessedTests([]);
      } catch (e) { appendLog(`Failed to reset DB: ${e.message}`); }
    }
  };

  const handleDeleteTest = async () => {
    if (!delTest) return;
    if (!confirm(`Delete test "${delTest}" and all its processed data?`)) return;
    try {
      const res = await axios.post(`${API}/api/dyno/delete_test`, { test_name: delTest });
      appendLog(res.data.message || res.data.error);
      loadProcessedTests();
    } catch (e) { appendLog(`Failed: ${e.message}`); }
  };

  const handlePromoteTest = async () => {
    if (!promoTest) return;
    try {
      const res = await axios.post(`${API}/api/dyno/promote_test`, { test_name: promoTest });
      appendLog(res.data.message || res.data.error);
    } catch (e) { appendLog(`Failed: ${e.message}`); }
  };

  const handlePasswordSubmit = () => {
    if (password === DEV_PASSWORD) {
      setDevUnlocked(true);
      appendLog("🔓 Developer Mode Unlocked.");
    } else {
      appendLog("❌ Invalid password.");
    }
  };

  const testNames = processedTests.map(t => t.Test_Name);

  return (
    <div style={{ display: "flex", minHeight: "100vh", maxHeight: "100vh" }}>
      <DynoSidebar appMode="Data Engine" setAppMode={() => {}} summaries={[]} />
      <main style={{ flex: 1, padding: "30px 40px", overflowY: "auto", background: "var(--bg-color)" }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 20, color: "#FFF" }}>Data Engine</h1>

        {/* Banner */}
        <div style={{ background: "rgba(55,140,255,0.1)", border: "1px solid rgba(55,140,255,0.3)", padding: "12px 16px", borderRadius: 8, marginBottom: 30, fontSize: 13, color: "#A0C8FF", display: "flex", alignItems: "center", gap: 10 }}>
          💡 <b>Active Golden Standard:</b> The Engine uses these bikes to build the Statistical Envelope: {goldenBikes}.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 30 }}>
          {/* LEFT: UPLOAD */}
          <div>
            <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ background: "#55AAFF", color: "#000", width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold" }}>1</span>
              Upload Raw Data
            </h3>
            <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 12 }}>Select Test Type</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {["Evaluation (Test)", "Baseline (Calibration)"].map(mode => (
                <label key={mode} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", cursor: "pointer", fontSize: 14 }}>
                  <input type="radio" name="uploadMode" checked={uploadMode === mode} onChange={() => setUploadMode(mode)} style={{ accentColor: "#43B3AE" }} />
                  {mode}
                </label>
              ))}
            </div>

            <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 8 }}>Drop .xlsx file(s) here</div>
            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              style={{ border: isHovering ? "2px dashed #43B3AE" : "1px dashed rgba(255,255,255,0.2)", background: isHovering ? "rgba(67,179,174,0.05)" : "var(--card-bg)", borderRadius: 12, padding: "30px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.2s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                <UploadCloud size={30} color={isHovering ? "#43B3AE" : "var(--text-title)"} />
                <div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Drag and drop files here</div>
                  <div style={{ color: "var(--text-sub)", fontSize: 12 }}>Limit 200MB per file • XLSX</div>
                </div>
              </div>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Browse files</button>
              <input type="file" multiple accept=".xlsx" ref={fileInputRef} style={{ display: "none" }} onChange={(e) => handleFilesAdded(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: 15 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", padding: "6px 12px", borderRadius: 6, marginBottom: 8, fontSize: 13, color: "#fff" }}>
                    <File size={14} color="#55AAFF" /> {f.name}
                  </div>
                ))}
                <button onClick={uploadFiles} style={{ width: "100%", background: "#43B3AE", color: "#000", border: "none", padding: "10px", borderRadius: 6, fontWeight: "bold", cursor: "pointer", marginTop: 10 }}>
                  Confirm Upload
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: CONTROLS & LOGS */}
          <div>
            <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ background: "#55AAFF", color: "#000", width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold" }}>2</span>
              Engine Controls
            </h3>
            <button onClick={runProcessing} disabled={isProcessing}
              style={{ width: "50%", padding: "12px 20px", background: "linear-gradient(90deg, #43B3AE, #3B9F9A)", color: "#000", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 14, cursor: isProcessing ? "not-allowed" : "pointer", opacity: isProcessing ? 0.7 : 1, boxShadow: "0 8px 20px rgba(67,179,174, 0.3)" }}>
              {isProcessing ? "Processing..." : "⚙️ Run Processing & DB Sync"}
            </button>

            <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20 }}>
              <a href={`${API}/api/dyno/export_db`} download="raptee_dyno.db" style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "linear-gradient(90deg, #43B3AE, #3B9F9A)", border: "none", borderRadius: 8, cursor: "pointer", color: "#000", fontSize: 14, fontWeight: 800, textDecoration: "none", marginBottom: 12 }}>
                <Download size={16} /> Download Master SQLite DB
              </a>
              <div onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, cursor: "pointer", color: "var(--text-sub)", fontSize: 14, transition: "0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.border = "1px solid #FF4B4B"}
                onMouseLeave={(e) => e.currentTarget.style.border = "1px solid rgba(255,255,255,0.05)"}>
                <Trash size={16} /> <b>Factory Reset Database</b>
              </div>
            </div>

            <div style={{ marginTop: 40 }}>
              <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 15 }}>
                <Terminal size={20} color="#FFA15A" /> System Processing Logs
              </h3>
              <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 8 }}>Live Terminal Output:</div>
              <div ref={logRef} style={{ background: "#0E0E11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "16px", height: 200, overflowY: "auto", fontFamily: "monospace", fontSize: 13, color: "#43B3AE", whiteSpace: "pre-wrap", boxShadow: "inset 0 4px 20px rgba(0,0,0,0.5)" }}>
                {logs || "Waiting for operations..."}
              </div>
            </div>
          </div>
        </div>

        {/* DEV ACCESS */}
        <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 30 }}>
          <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 15 }}>
            <Lock size={20} color="#FF4B4B" /> Developer Access: Test Management
          </h3>

          {!devUnlocked ? (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                placeholder="Enter Developer Password"
                style={{ flex: 1, maxWidth: 350, padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#FFF", fontSize: 14 }} />
              <button onClick={handlePasswordSubmit} style={{ padding: "12px 20px", background: "rgba(255,75,75,0.15)", border: "1px solid rgba(255,75,75,0.3)", color: "#FF4B4B", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                Unlock
              </button>
            </div>
          ) : (
            <div>
              <div style={{ background: "rgba(67,179,174,0.08)", border: "1px solid rgba(67,179,174,0.2)", padding: "10px 16px", borderRadius: 8, color: "#43B3AE", fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
                ✅ Access Granted: Developer Mode Unlocked
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
                {/* Delete Test */}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <XCircle size={18} color="#FF4B4B" /> Delete Specific Test
                  </div>
                  <div style={{ marginBottom: 12, overflow: "visible" }}>
                    <StreamlitSelect value={delTest} onChange={setDelTest} options={testNames} placeholder="Select test to delete" />
                  </div>
                  <button onClick={handleDeleteTest} style={{ padding: "10px 20px", background: "rgba(255,75,75,0.15)", border: "1px solid rgba(255,75,75,0.3)", color: "#FF4B4B", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    🗑️ Delete Selected Test
                  </button>
                </div>

                {/* Promote Test */}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <Star size={18} color="#FFD700" /> Promote to Golden Baseline
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 12, padding: "8px 12px", background: "rgba(55,140,255,0.1)", border: "1px solid rgba(55,140,255,0.2)", borderRadius: 6 }}>
                    Moves an evaluated test into the Calibration folder to widen the statistical envelope.
                  </div>
                  <div style={{ marginBottom: 12, overflow: "visible" }}>
                    <StreamlitSelect value={promoTest} onChange={setPromoTest} options={testNames} placeholder="Select test to promote" />
                  </div>
                  <button onClick={handlePromoteTest} style={{ padding: "10px 20px", background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    ⭐ Promote & Reprocess
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}


