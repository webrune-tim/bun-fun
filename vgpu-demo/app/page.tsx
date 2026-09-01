"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { DEMOS, DemoItem, Category } from "@/app/demos";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Category | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("all");
  const [spotlightId, setSpotlightId] = useState<string>("opt-blackhole");
  const [webGpuSupported, setWebGpuSupported] = useState<boolean | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "spotlight">("grid");

  useEffect(() => {
    setSearchQuery("");
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      setWebGpuSupported(true);
    } else {
      setWebGpuSupported(false);
    }
  }, []);

  const filteredDemos = useMemo(() => {
    return DEMOS.filter((demo) => {
      const matchesCategory =
        activeTab === "all" || demo.category === activeTab;
      const matchesSearch =
        searchQuery.trim() === "" ||
        demo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        demo.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        demo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        demo.tags.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchesCategory && matchesSearch;
    });
  }, [activeTab, searchQuery]);

  const currentSpotlight =
    DEMOS.find((d) => d.id === spotlightId) || DEMOS[0];

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-[#07080b] text-zinc-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200"
    >
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-[130px] rounded-full" />
        <div className="absolute top-[40%] right-[-10%] w-[600px] h-[400px] bg-gradient-to-t from-cyan-600/10 via-blue-600/5 to-transparent blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[400px] bg-gradient-to-t from-emerald-600/10 via-indigo-600/5 to-transparent blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Navigation Bar */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 border-b border-zinc-800/80 mb-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  vgpu
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  v0.3.1
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                  {DEMOS.length} Full Demos
                </span>
              </div>
              <p className="text-xs text-zinc-400">WebGPU Shaders, Compute & Render Pipelines</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* WebGPU Status Pill */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                webGpuSupported === true
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : webGpuSupported === false
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  webGpuSupported === true
                    ? "bg-emerald-400 animate-pulse"
                    : webGpuSupported === false
                    ? "bg-amber-400"
                    : "bg-zinc-500"
                }`}
              />
              {webGpuSupported === true
                ? "WebGPU Accelerated"
                : webGpuSupported === false
                ? "WebGPU Not Detected"
                : "Checking GPU..."}
            </div>

            <a
              href="https://vgpu.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 text-zinc-200 text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Documentation
            </a>
          </div>
        </header>

        {/* Hero Title Section */}
        <section className="text-center mb-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-400 mb-4 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Click any card to open the interactive full-page view
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent pb-1">
            VGPU Shader Gallery
          </h1>
          <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed">
            Interactive real-time graphics rendered natively with WebGPU in your browser.
            Explore relativistic physics, multi-pass bloom chains, and analytic lighting.
          </p>
        </section>

        {/* Controls Toolbar: Search, Tabs & View Switcher */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 bg-zinc-900/40 p-2.5 rounded-2xl border border-zinc-800/60 backdrop-blur-md">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1">
            {[
              { id: "all", label: `All (${DEMOS.length})` },
              { id: "raymarching", label: "Raymarching" },
              { id: "lighting", label: "Lighting & HDR" },
              { id: "simulation", label: "Simulation & FFT" },
              { id: "rendering", label: "Pipelines & AA" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Category | "all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Search Input */}
            <div className="relative flex-1 md:w-48">
              <input
                type="text"
                placeholder="Search shaders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3 py-1.5 pl-8 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/50 transition-all"
              />
              <svg
                className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800/80 shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Grid View"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("spotlight")}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "spotlight"
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
                title="Spotlight View"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="12" rx="2" />
                  <line x1="3" y1="19" x2="21" y2="19" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* VIEW 1: SPOTLIGHT VIEW */}
        {viewMode === "spotlight" && (
          <div className="flex flex-col gap-6 mb-16">
            <div className="relative w-full h-[500px] sm:h-[620px] rounded-3xl overflow-hidden border border-zinc-800/80 shadow-2xl bg-black group">
              {currentSpotlight.component}
              
              {/* Overlay Info Bar */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pointer-events-none">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {currentSpotlight.category}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {currentSpotlight.controlsHint}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">
                    {currentSpotlight.title}
                  </h2>
                  <p className="text-sm text-zinc-300 mt-1 leading-relaxed">
                    {currentSpotlight.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {currentSpotlight.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  href={`/demo/${currentSpotlight.id}`}
                  className="pointer-events-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-600/30 shrink-0"
                >
                  <span>Open Full Page</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Spotlight Selector Carousel Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredDemos.map((demo) => {
                const isSelected = demo.id === currentSpotlight.id;
                return (
                  <button
                    key={demo.id}
                    onClick={() => setSpotlightId(demo.id)}
                    className={`p-3.5 rounded-2xl text-left border transition-all ${
                      isSelected
                        ? "bg-zinc-900 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                        : "bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-900/60 hover:border-zinc-700"
                    }`}
                  >
                    <span className="text-[10px] font-mono text-indigo-400 block mb-1 uppercase">
                      {demo.category}
                    </span>
                    <h4 className="font-semibold text-xs text-zinc-100 truncate">
                      {demo.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {demo.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: RESPONSIVE GRID VIEW */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filteredDemos.map((demo) => (
              <div
                key={demo.id}
                className="group relative flex flex-col rounded-3xl overflow-hidden bg-zinc-950/80 border border-zinc-800/80 hover:border-zinc-700 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-indigo-500/10"
              >
                {/* Canvas Container */}
                <div className="relative w-full h-[280px] bg-black overflow-hidden border-b border-zinc-800/80">
                  {demo.component}

                  {/* Interactive Controls Overlay Badge */}
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono text-zinc-300 max-w-[200px] truncate block">
                      {demo.controlsHint}
                    </span>
                  </div>

                  {/* Fullscreen Page Link */}
                  <Link
                    href={`/demo/${demo.id}`}
                    className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-black/70 hover:bg-indigo-600 backdrop-blur-md border border-white/10 text-zinc-200 hover:text-white transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs font-medium shadow-lg hover:scale-105"
                    title="Open Fullpage Demo"
                  >
                    <span>Fullpage</span>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  </Link>
                </div>

                {/* Card Info & Details with Clickable Link */}
                <Link
                  href={`/demo/${demo.id}`}
                  className="p-5 flex flex-col flex-1 justify-between gap-3 hover:bg-zinc-900/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 font-mono">
                        {demo.category}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 group-hover:text-indigo-300 transition-colors">
                        View Fullpage →
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-200 transition-colors">
                      {demo.title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium mb-2 truncate">
                      {demo.subtitle}
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                      {demo.description}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 pt-2">
                    {demo.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-medium text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                    {demo.tags.length > 3 && (
                      <span className="px-1.5 py-0.5 text-[10px] text-zinc-500 font-mono">
                        +{demo.tags.length - 3}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Feature Highlights Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12 border-t border-zinc-800/80 mb-12">
          <div className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/60">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h4 className="font-semibold text-base text-white mb-1">Native WebGPU</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Direct access to device compute, custom WGSL shaders, storage buffers, and swapchain textures without legacy WebGL overhead.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/60">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </div>
            <h4 className="font-semibold text-base text-white mb-1">Multi-Pass Pipelines</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Chained render passes for real-time post processing including Gaussian bloom, ACES tone-mapping, and spatial noise jitter.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/60">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <h4 className="font-semibold text-base text-white mb-1">Responsive Scaling</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Dynamic surface resizing with automatic DPR adaptation and high-DPI retina display support.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 pb-16 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} vgpu Showcase Gallery. Built with Next.js & WebGPU.</p>
          <div className="flex items-center gap-6">
            <a
              href="https://vgpu.sh/docs/get-started/web"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              Get Started Guide
            </a>
            <a
              href="https://github.com/vercel-labs/vgpu"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://gpuweb.github.io/gpuweb/wgsl/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              WGSL Spec
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
