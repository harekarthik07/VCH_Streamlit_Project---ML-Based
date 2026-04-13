"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function MasterDashboard() {
  const [overviewData, setOverviewData] = useState({
    dyno_total: 0, road_total: 0, golden_count: 0, recent_activity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        // Using 127.0.0.1 to bypass slow localhost DNS resolution
        const res = await fetch("http://127.0.0.1:8001/api/master/overview", {
          next: { revalidate: 0 } // Disable caching for live telemetry
        });

        if (!res.ok) throw new Error(`HTTP Error! Status: ${res.status}`);

        const data = await res.json();
        setOverviewData(data);
        setError(null);
      } catch (err) {
        console.error("Fetch failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (error) return (
    <div className="min-h-screen bg-[#0b0c10] flex items-center justify-center p-10">
      <div className="bg-red-500/10 border border-red-500 p-6 rounded-xl text-center">
        <h2 className="text-red-500 font-bold text-xl mb-2">🚨 Backend Connection Failed</h2>
        <p className="text-white/70 text-sm">Make sure FastAPI is running on port 8001</p>
        <p className="text-red-400 mt-4 text-xs font-mono">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-red-500 text-white rounded-lg font-bold">Retry Connection</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white p-8 font-sans bg-[radial-gradient(circle_at_50%_-20%,#1e2430_0%,#0b0c10_70%)]">
      {/* HEADER BANNER */}
      <div className="flex justify-between items-center mb-10 bg-[#1F1F23]/40 border border-white/20 rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-3xl font-black italic tracking-wide text-white">RAPTEE<span className="text-[#00cc96]">.HV</span></h1>
          <p className="text-[#A0A0AB] text-sm uppercase tracking-widest mt-1 font-bold">VCH Master Command Center</p>
        </div>
        <div className="flex space-x-4">
          <Link href="/dyno" className="px-6 py-3 bg-[#2D2D33]/60 border border-white/20 rounded-xl hover:border-[#00cc96] hover:text-[#00cc96] transition-all font-bold text-sm tracking-wide">🏍️ Launch Dyno Suite</Link>
          <Link href="/road" className="px-6 py-3 bg-[#2D2D33]/60 border border-white/20 rounded-xl hover:border-[#00cc96] hover:text-[#00cc96] transition-all font-bold text-sm tracking-wide">🛣️ Launch Road Suite</Link>
        </div>
      </div>

      {/* KPI BENTO BOXES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#19191e]/40 backdrop-blur-md border border-white/20 border-t-white/30 rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform">
          <div className="text-[#B4B4C0] text-xs uppercase tracking-widest font-bold mb-2">Total Dyno Logs</div>
          <div className="text-4xl font-extrabold text-[#00cc96]">{loading ? "..." : overviewData.dyno_total}</div>
        </div>

        <div className="bg-[#19191e]/40 backdrop-blur-md border border-white/20 border-t-white/30 rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform">
          <div className="text-[#B4B4C0] text-xs uppercase tracking-widest font-bold mb-2">Total Road Logs</div>
          <div className="text-4xl font-extrabold text-[#ab63fa]">{loading ? "..." : overviewData.road_total}</div>
        </div>

        <div className="bg-[#19191e]/40 backdrop-blur-md border border-[#FFD700]/30 border-t-[#FFD700]/60 rounded-2xl p-6 shadow-xl hover:-translate-y-1 transition-transform bg-gradient-to-br from-[#FFD700]/5 to-transparent">
          <div className="text-[#B4B4C0] text-xs uppercase tracking-widest font-bold mb-2">Active Golden Bikes</div>
          <div className="text-4xl font-extrabold text-[#FFD700]">{loading ? "..." : overviewData.golden_count}</div>
        </div>
      </div>

      {/* RECENT ACTIVITY TABLE */}
      <div className="bg-[#19191e]/40 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-bold tracking-wide text-white">🔄 Recent System Activity</h2>
          {loading && <div className="text-[#00cc96] text-xs animate-pulse font-bold">SYNCING LIVE DB...</div>}
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#2D2D33]/30 text-[#A0A0AB] text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Test ID</th>
                <th className="px-6 py-4 font-semibold">Environment</th>
                <th className="px-6 py-4 font-semibold">Classification</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {overviewData.recent_activity.map((act, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 text-[#B4B4C0] font-medium">{act.date}</td>
                  <td className="px-6 py-4 font-bold text-white truncate max-w-[300px]">{act.id}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-md text-xs font-bold ${act.suite === "Dyno" ? "bg-[#00cc96]/10 text-[#00cc96] border border-[#00cc96]/20" : "bg-[#ab63fa]/10 text-[#ab63fa] border border-[#ab63fa]/20"
                      }`}>
                      {act.suite}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#A0A0AB]">{act.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}