"use client";

import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { UploadCloud, File, Trash, Terminal, Lock, XCircle, Star, Download, MapPin, Thermometer, User, Route, Cpu } from "lucide-react";
import DynoSidebar from "../components/DynoSidebar";
import StreamlitSelect from "../components/StreamlitSelect";

const API = process.env.NEXT_PUBLIC_API || "http://localhost:8001";
const DEV_PASSWORD = "test@123";

export default function DataEnginePage() {
  const [suite, setSuite] = useState("Dyno"); // "Dyno" or "Road"
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
  
  // Road Specific Metadata
  const [roadMeta, setRoadMeta] = useState({
    rider: "System Test",
    temp: "25",
    location: "Chennai",
    route: "Office Full Push"
  });

  const fileInputRef = useRef(null);
  const logRef = useRef(null);

  const goldenBikes = "2025_10_22-07-BK, 2025_10_09-14-BK, 2025_10_25-09-BK (Nw-BB), 2025_10_20-15-BK, 2025_10_19-17-BK, 2025_10_25-04-BK (Nw-BB)";

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Load processed tests for dev panel
  const loadProcessedTests = async () => {
    try {
      const endpoint = suite === "Dyno" ? `${API}/api/dyno/processed_tests` : `${API}/api/road/summaries`;
      const res = await axios.get(endpoint);
      const tests = Array.isArray(res.data) ? res.data : [];
      setProcessedTests(tests);
      const nameKey = suite === "Dyno" ? "Test_Name" : "Ride_Name";
      if (tests.length > 0) {
        setDelTest(tests[0][nameKey]);
        setPromoTest(tests[0][nameKey]);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (devUnlocked) loadProcessedTests();
  }, [devUnlocked, suite]);

  const handleDragOver = (e) => { e.preventDefault(); setIsHovering(true); };
  const handleDragLeave = () => setIsHovering(false);
  const handleDrop = (e) => { e.preventDefault(); setIsHovering(false); handleFilesAdded(e.dataTransfer.files); };

  const handleFilesAdded = (fileList) => {
    const newFiles = Array.from(fileList).filter(f => f.name.endsWith('.xlsx'));
    setFiles(prev => [...prev, ...newFiles]);
    appendLog(newFiles.length > 0 ? `Queued ${newFiles.length} file(s) for ${suite} Suite.` : `Error: Please upload .xlsx files only.`);
  };

  const appendLog = (msg) => setLogs(prev => prev + `> ${msg}\n`);

  const uploadFiles = async () => {
    if (files.length === 0) return;
    appendLog(`Starting ${suite} upload sequence for ${files.length} file(s)...`);
    
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      
      if (suite === "Dyno") {
        formData.append("mode", uploadMode);
      } else {
        formData.append("rider", roadMeta.rider);
        formData.append("temp", roadMeta.temp);
        formData.append("location", roadMeta.location);
        formData.append("route", roadMeta.route);
      }

      try {
        const endpoint = suite === "Dyno" ? `${API}/api/dyno/upload` : `${API}/api/road/upload`;
        await axios.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });
        appendLog(`✅ Uploaded: ${file.name}`);
      } catch (e) { appendLog(`❌ Failed to upload ${file.name}: ${e.message}`); }
    }
    setFiles([]);
    appendLog(`Upload sequence complete.`);
  };

  const runProcessing = async () => {
    setIsProcessing(true);
    appendLog(`--- Initiating ${suite} Processing Engine ---`);
    try {
      const endpoint = suite === "Dyno" ? `${API}/api/dyno/process` : `${API}/api/road/process`;
      const res = await axios.post(endpoint);
      if (res.data.logs) setLogs(prev => prev + res.data.logs + "\n");
      if (res.data.error) appendLog(`[ERROR]: ${res.data.error}`);
      else {
        const count = suite === "Dyno" ? (res.data.result?.Processed || 0) : (res.data.result?.processed_count || 0);
        appendLog(`✅ Processing complete. Synchronized ${count} files.`);
      }
    } catch (e) { appendLog(`[FATAL]: Cannot connect to Engine Backend. (${e.message})`); }
    setIsProcessing(false);
  };

  const handleReset = async () => {
    if (confirm(`WARNING: This will wipe out the entire ${suite} DB and processed files. Are you sure?`)) {
      try {
        const endpoint = suite === "Dyno" ? `${API}/api/dyno/reset` : `${API}/api/road/reset`;
        await axios.post(endpoint);
        appendLog(`⚠️ FACTORY RESET COMPLETE. ${suite} Database has been wiped.`);
        setProcessedTests([]);
      } catch (e) { appendLog(`Failed to reset DB: ${e.message}`); }
    }
  };

  const handleDeleteTest = async () => {
    if (!delTest) return;
    if (!confirm(`Delete ${suite === "Dyno" ? "test" : "ride"} "${delTest}" and all its processed data?`)) return;
    try {
      const endpoint = suite === "Dyno" ? `${API}/api/dyno/delete_test` : `${API}/api/road/delete_ride`;
      const payload = suite === "Dyno" ? { test_name: delTest } : { ride_name: delTest };
      const res = await axios.post(endpoint, payload);
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

  const testNames = processedTests.map(t => suite === "Dyno" ? t.Test_Name : t.Ride_Name);

  return (
    <div style={{ display: "flex", minHeight: "100vh", maxHeight: "100vh" }}>
      <DynoSidebar appMode="Data Engine" setAppMode={() => {}} summaries={[]} />
      <main style={{ flex: 1, padding: "30px 40px", overflowY: "auto", background: "var(--bg-color)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#FFF" }}>Data Engine</h1>
          
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", padding: 6, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", gap: 4 }}>
            {["Dyno", "Road"].map(s => {
              const isActive = suite === s;
              return (
                <button
                  key={s}
                  onClick={() => { setSuite(s); setFiles([]); }}
                  style={{
                    padding: "10px 24px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 800,
                    background: isActive ? "#43B3AE" : "transparent",
                    color: isActive ? "#000" : "#B4B4C0",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "flex", alignItems: "center", gap: 8,
                    boxShadow: isActive ? "0 4px 15px rgba(67, 179, 174, 0.3)" : "none"
                  }}
                >
                  {s === "Dyno" ? <Cpu size={16} /> : <Route size={16} />}
                  {s} Suite
                </button>
              );
            })}
          </div>
        </div>

        {/* Banner */}
        {suite === "Dyno" && (
          <div style={{ background: "rgba(55,140,255,0.1)", border: "1px solid rgba(55,140,255,0.3)", padding: "12px 16px", borderRadius: 8, marginBottom: 30, fontSize: 13, color: "#A0C8FF", display: "flex", alignItems: "center", gap: 10 }}>
            💡 <b>Active Golden Standard:</b> The Engine uses these bikes to build the Statistical Envelope: {goldenBikes}.
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 30 }}>
          {/* LEFT: UPLOAD */}
          <div>
            <h3 style={{ fontSize: 18, color: "#fff", display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ background: "#55AAFF", color: "#000", width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold" }}>1</span>
              Upload Raw {suite} Data
            </h3>
            
            {suite === "Dyno" ? (
              <>
                <div style={{ fontSize: 13, color: "var(--text-sub)", marginBottom: 12 }}>Select Test Type</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {["Evaluation (Test)", "Baseline (Calibration)"].map(mode => (
                    <label key={mode} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", cursor: "pointer", fontSize: 14 }}>
                      <input type="radio" name="uploadMode" checked={uploadMode === mode} onChange={() => setUploadMode(mode)} style={{ accentColor: "#43B3AE" }} />
                      {mode}
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.03)", padding: 20, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#43B3AE", textTransform: "uppercase", marginBottom: 15, letterSpacing: 1 }}>Ride Metadata</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}><User size={12}/> Rider Name</label>
                    <input value={roadMeta.rider} onChange={e => setRoadMeta({...roadMeta, rider: e.target.value})} style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}><Thermometer size={12}/> Ambient (°C)</label>
                    <input type="number" value={roadMeta.temp} onChange={e => setRoadMeta({...roadMeta, temp: e.target.value})} style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}><MapPin size={12}/> Location</label>
                    <input value={roadMeta.location} onChange={e => setRoadMeta({...roadMeta, location: e.target.value})} style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}><Route size={12}/> Route Tag</label>
                    <select value={roadMeta.route} onChange={e => setRoadMeta({...roadMeta, route: e.target.value})} style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 13, appearance: "none" }}>
                      <option>Office Full Push</option>
                      <option>Road Full Push</option>
                      <option>Highway Sprint</option>
                      <option>City Traffic</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

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
                  Confirm Upload to {suite} Suite
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
              {isProcessing ? "Processing..." : `⚙️ Run ${suite} Processing`}
            </button>

            <div style={{ marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20 }}>
              <a href={`${API}/api/${suite.toLowerCase()}/export_db`} download={`raptee_${suite.toLowerCase()}.db`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "linear-gradient(90deg, #43B3AE, #3B9F9A)", border: "none", borderRadius: 8, cursor: "pointer", color: "#000", fontSize: 14, fontWeight: 800, textDecoration: "none", marginBottom: 12 }}>
                <Download size={16} /> Download Master {suite} DB
              </a>
              <div onClick={handleReset} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, cursor: "pointer", color: "var(--text-sub)", fontSize: 14, transition: "0.2s" }}
                onMouseEnter={(e) => e.currentTarget.style.border = "1px solid #FF4B4B"}
                onMouseLeave={(e) => e.currentTarget.style.border = "1px solid rgba(255,255,255,0.05)"}>
                <Trash size={16} /> <b>Factory Reset {suite} Database</b>
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
            <Lock size={20} color="#FF4B4B" /> Developer Access: {suite} Test Management
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
                    <XCircle size={18} color="#FF4B4B" /> Delete Specific {suite === "Dyno" ? "Test" : "Ride"}
                  </div>
                  <div style={{ marginBottom: 12, overflow: "visible" }}>
                    <StreamlitSelect value={delTest} onChange={setDelTest} options={testNames} placeholder={`Select ${suite === "Dyno" ? "test" : "ride"} to delete`} />
                  </div>
                  <button onClick={handleDeleteTest} style={{ padding: "10px 20px", background: "rgba(255,75,75,0.15)", border: "1px solid rgba(255,75,75,0.3)", color: "#FF4B4B", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                    🗑️ Delete Selected {suite === "Dyno" ? "Test" : "Ride"}
                  </button>
                </div>

                {/* Promote Test (Dyno Only) */}
                {suite === "Dyno" && (
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
                )}
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}


