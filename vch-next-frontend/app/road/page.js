"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { UploadCloud, Activity, Thermometer, Zap, ArrowLeft, Gauge, BatteryCharging, TrendingUp } from "lucide-react";

// Dynamically import Plotly to avoid Next.js "window is not defined" SSR errors
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-[#00cc96] font-medium animate-pulse">
      Loading Plotly Engine...
    </div>
  ),
});

export default function RoadSuiteThermal() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [appMode, setAppMode] = useState("Monitor Dashboard");

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);

    setTimeout(() => {
      const time = Array.from({ length: 150 }, (_, i) => i * 0.5);
      const motorTemp = time.map((t) => 40 + t * 0.4 + Math.random() * 5);
      const igbtTemp = time.map((t) => 35 + t * 0.3 + Math.random() * 3);
      const afeTemp = time.map((t) => 30 + t * 0.1 + Math.random() * 2);
      const cellTemp = time.map((t) => 32 + t * 0.12 + Math.random() * 2);

      setChartData({ time, motorTemp, igbtTemp, afeTemp, cellTemp });
      setMetrics({
        motor: { max: Math.max(...motorTemp).toFixed(1), limit: 125.0 },
        igbt: { max: Math.max(...igbtTemp).toFixed(1), limit: 95.0 },
        afe: { max: Math.max(...afeTemp).toFixed(1), limit: 50.0 },
        highCell: { max: Math.max(...cellTemp).toFixed(1), limit: 50.0, cellNo: 12 },
      });
      setLoading(false);
    }, 1200);
  };

  const renderMetricCard = (title, data, unit = "°C", accent = "#00cc96") => {
    const isBreach = data.max >= data.limit;
    const color = isBreach ? "#FF4B4B" : accent;
    const status = isBreach ? "🔥 BREACH" : "✅ SAFE";

    return (
      <div className={`rounded-3xl border ${isBreach ? "border-[#FF4B4B]/40" : "border-white/10"} bg-[#11131a]/80 p-5 shadow-xl`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="text-xs uppercase tracking-[0.25em] text-gray-400">{title}</span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-white/5 text-sm" style={{ color }}>
            •
          </span>
        </div>
        <div className="text-3xl font-black" style={{ color }}>
          {data.max} {unit}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          <span>Limit {data.limit.toFixed(1)}{unit}</span>
          <span className="font-semibold" style={{ color }}>{status}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#070b10] text-white px-6 py-10 sm:px-10 lg:px-14 font-sans">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="relative rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_40px_120px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
          <Link href="/" className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0b0c10]/85 px-4 py-2 text-sm text-gray-300 transition hover:bg-[#111519]">
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-full bg-[#00cc9666] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#d7ffe9]">
              Road VCH Suite
            </div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Road Suite Thermal System</h1>
            <p className="max-w-3xl text-gray-400 text-lg leading-8">
              Dynamic telemetry processing and thermal protection analytics with streamlined upload controls and a monitoring-first dashboard.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { label: "Monitor Dashboard", active: appMode === "Monitor Dashboard" },
              { label: "Data Engine", active: appMode === "Data Engine" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setAppMode(item.label)}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${item.active ? "bg-[#00cc96]/15 text-[#00cc96] border border-[#00cc96]/20" : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <main className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-[#11131a]/85 p-6 shadow-xl">
              <div className="mb-5 flex items-center gap-3 text-lg font-semibold text-white">
                <UploadCloud size={20} className="text-[#00cc96]" /> Upload & Tag Data
              </div>
              <p className="text-sm text-gray-400 mb-5">
                Upload raw Road Test files and instantly generate thermal insights.
              </p>
              <form onSubmit={handleFileUpload} className="space-y-5">
                <label className="block text-sm font-semibold text-gray-300">Raw CAN Log or Excel</label>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b0c10]/90 px-4 py-3 text-sm text-gray-300 file:mr-4 file:rounded-full file:border-0 file:bg-[#00cc96]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#00cc96] hover:file:bg-[#00cc96]/20"
                />
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#00cc96] to-[#00b383] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#070b10] transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <Activity className="animate-spin" /> : <Zap size={16} />}
                  {loading ? "Processing…" : "Run Thermal Analysis"}
                </button>
              </form>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-[#11131a]/85 p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3 text-lg font-semibold text-white">
                <Gauge size={20} className="text-[#00cc96]" /> Engine Controls
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Use this panel to refresh data, manage uploads, and trigger analytics in the JS Road Suite.
              </p>
              <div className="grid gap-3">
                <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-gray-300 transition hover:bg-white/10">
                  Refresh Data
                </button>
                <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-gray-300 transition hover:bg-white/10">
                  Manage Ride Tags
                </button>
              </div>
            </section>
          </aside>

          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {metrics ? (
                [
                  renderMetricCard("Motor Temp", metrics.motor, "°C", "#ff4b4b"),
                  renderMetricCard("IGBT Temp", metrics.igbt, "°C", "#ffa500"),
                  renderMetricCard("Pack AFE Temp", metrics.afe, "°C", "#00cc96"),
                  renderMetricCard(`High Cell (#${metrics.highCell.cellNo})`, metrics.highCell, "°C", "#1f77b4"),
                ]
              ) : (
                <div className="col-span-full rounded-[2rem] border border-dashed border-white/10 bg-[#11131a]/80 p-10 text-center text-gray-400">
                  Upload a file to reveal temperature metrics and the combined thermal overlay.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#11131a]/85 p-6 shadow-xl">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Combined Thermal Overlay</h2>
                  <p className="text-sm text-gray-400">Visualize the vehicle thermal response across all channels in one place.</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-300">
                  <Activity size={14} /> {appMode}
                </span>
              </div>
              <div className="h-[520px] rounded-[1.5rem] bg-[#070b10]/80 p-4">
                {chartData ? (
                  <Plot
                    data={[
                      { x: chartData.time, y: chartData.motorTemp, type: "scatter", mode: "lines", name: "Motor", line: { color: "#ff4b4b", width: 2 } },
                      { x: chartData.time, y: chartData.igbtTemp, type: "scatter", mode: "lines", name: "IGBT", line: { color: "#ffa500", width: 2 } },
                      { x: chartData.time, y: chartData.afeTemp, type: "scatter", mode: "lines", name: "AFE", line: { color: "#00cc96", width: 2 } },
                      { x: chartData.time, y: chartData.cellTemp, type: "scatter", mode: "lines", name: "High Cell", line: { color: "#1f77b4", width: 2 } },
                    ]}
                    layout={{
                      autosize: true,
                      paper_bgcolor: "rgba(0,0,0,0)",
                      plot_bgcolor: "rgba(0,0,0,0)",
                      font: { color: "#ddd" },
                      margin: { l: 40, r: 20, t: 20, b: 40 },
                      xaxis: { title: "Time (s)", showgrid: true, gridcolor: "#222" },
                      yaxis: { title: "Temp (°C)", showgrid: true, gridcolor: "#222" },
                      legend: { orientation: "h", y: 1.14, x: 0 },
                      hovermode: "x unified",
                    }}
                    useResizeHandler={true}
                    style={{ width: "100%", height: "100%" }}
                    config={{ displayModeBar: false, responsive: true }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-[1.5rem] bg-[#0b0f15] text-gray-500">
                    Upload a road test file to display the thermal overlay chart.
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
