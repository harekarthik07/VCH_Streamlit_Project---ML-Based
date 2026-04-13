import Link from "next/link";

const SUITES = [
  {
    href: "/dyno",
    icon: "⚙️",
    title: "Dyno Suite",
    copy: "Strict Quality Control gatekeeper designed to evaluate stationary Dewesoft telemetry against mathematically calculated Golden Standards.",
    features: [
      "Automated ±2-Sigma statistical envelopes.",
      "Dynamic power and early deration tracking.",
      "1-click executive Word report generator.",
    ],
    buttonText: "Launch Dyno Engine →",
    buttonClass: "text-[#d7ffe9] bg-[#0f141d]/90 border-white/10 hover:bg-[#0a0e14]",
  },
  {
    href: "/road",
    icon: "🛣️",
    title: "Road Suite",
    copy: "Dynamic telemetry processing engine for raw CAN logs, powertrain performance visualization, and battery efficiency mapping.",
    features: [
      "Raw CAN & Excel decoding to 2Hz time series.",
      "SOC drain and Wh/km efficiency tracking.",
      "Thermal protection overlay maps.",
    ],
    buttonText: "Launch Road Engine →",
    buttonClass: "text-[#00cc96] bg-[#0f141d]/90 border-[#00cc96]/20 hover:bg-[#07100c]",
  },
];

export default function Home() {
  return (
    <div
      className="min-h-screen px-6 py-10 sm:px-10 lg:px-14 text-white"
      style={{
        background: "radial-gradient(circle at 28% 6%, rgba(0, 204, 150, 0.18), transparent 18%), radial-gradient(circle at 78% 10%, rgba(85, 170, 255, 0.08), transparent 18%), #070a10",
      }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-10">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-10 shadow-[0_45px_120px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full bg-[#00cc9666] px-4 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-[#d7ffe9] shadow-[0_12px_40px_rgba(0,204,150,0.12)]">
                Raptee Thermal Suite
              </div>
              <div className="space-y-4">
                <h1 className="text-5xl font-black tracking-tight sm:text-6xl">Thermal & Dynamics Analytics Engine V4</h1>
                <p className="text-lg text-gray-300 leading-8">
                  A modern JS dashboard for the same Streamlit workflow: launch Dyno or Road engines, inspect telemetry, and run quality control from one unified interface.
                </p>
              </div>
              <div className="text-sm text-gray-400">
                Logged in as: <span className="text-[#00cc96] font-semibold">admin</span>
              </div>
            </div>

            <div className="space-y-4 rounded-[1.8rem] border border-[#00cc96]/10 bg-[#0b121d]/95 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.25)]">
              <p className="text-xs uppercase tracking-[0.3em] text-[#00cc96]/90">Quick Launch</p>
              <div className="grid gap-3">
                <a href="/dyno" className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-[#0f141d]/90 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#d7ffe9] transition hover:bg-[#0a0e14]">
                  Open Dyno Suite
                </a>
                <a href="/road" className="inline-flex items-center justify-center rounded-2xl border border-[#00cc96]/20 bg-[#0f141d]/90 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#00cc96] transition hover:bg-[#07100c]">
                  Open Road Suite
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-[#0d111c]/80 p-8 shadow-[0_28px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
            <h2 className="text-3xl font-semibold text-white">🚀 Active Testing Environments</h2>
            <p className="mt-3 text-gray-400 text-base leading-7">
              Select a module below to launch the dedicated evaluation suites. This interface now mirrors the Streamlit structure with clear cards, concise module summaries, and strong visual hierarchy.
            </p>
          </div>

          <div className="grid gap-8 xl:grid-cols-2">
            {SUITES.map((suite) => (
              <div key={suite.href} className="group overflow-hidden rounded-[2rem] border border-white/10 bg-[#11131a]/85 p-10 shadow-[0_35px_90px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-1 hover:border-[#00cc96]/30">
                <div className="text-6xl mb-6">{suite.icon}</div>
                <h3 className="text-4xl font-black mb-4 text-white">{suite.title}</h3>
                <p className="text-gray-400 mb-8 text-base leading-8">{suite.copy}</p>
                <ul className="text-gray-500 space-y-3 mb-10 text-sm">
                  {suite.features.map((feature) => (
                    <li key={feature} className="border-l-2 border-gray-700 pl-3">{feature}</li>
                  ))}
                </ul>
                <a href={suite.href} className={`inline-flex w-full justify-center rounded-2xl border px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] shadow-[0_15px_40px_rgba(0,204,150,0.16)] transition ${suite.buttonClass}`}>
                  {suite.buttonText}
                </a>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
