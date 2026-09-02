"use client";

import { use, useState, useEffect } from "react";
import { notFound } from "next/navigation";
import { DEMOS } from "@/app/demos";
import { ColorWheel, TransitionLink, useTransitionRouter } from "@/app/components";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DemoPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useTransitionRouter();
  const [showInfo, setShowInfo] = useState(false);

  const demoIndex = DEMOS.findIndex((d) => d.id === id);
  const demo = DEMOS[demoIndex];

  if (!demo) {
    notFound();
  }

  const prevDemo = DEMOS[(demoIndex - 1 + DEMOS.length) % DEMOS.length];
  const nextDemo = DEMOS[(demoIndex + 1) % DEMOS.length];
  const DemoComponent = demo.Component;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        router.push("/", { type: "gallery" });
      } else if (e.key === "ArrowLeft" && e.altKey) {
        router.push(`/demo/${prevDemo.id}`, { type: "backward" });
      } else if (e.key === "ArrowRight" && e.altKey) {
        router.push(`/demo/${nextDemo.id}`, { type: "forward" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, prevDemo.id, nextDemo.id]);

  return (
    <div
      suppressHydrationWarning
      className="relative w-screen h-screen overflow-hidden bg-black text-white font-sans flex flex-col select-none"
    >
      {/* Top Navigation Bar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/80 z-30 vt-persistent">
        <div className="flex items-center gap-3 sm:gap-4">
          <TransitionLink
            href="/"
            transitionType="gallery"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-medium text-zinc-200 transition-all hover:scale-105 active:scale-95 shadow-md shadow-black/50"
            title="Back to Gallery (Esc)"
          >
            <div className="w-5 h-5 rounded-md overflow-hidden relative ring-1 ring-white/20 shrink-0 bg-black vt-logo">
              <ColorWheel className="w-full h-full" />
            </div>
            <span className="hidden sm:inline">Gallery</span>
          </TransitionLink>

          <div className="h-4 w-px bg-zinc-800" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base text-white tracking-tight leading-tight vt-title">
                {demo.title}
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 vt-badge">
                {demo.category}
              </span>
            </div>
          </div>
        </div>

        {/* Center Hint for Controls */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 shadow-inner">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          <span className="font-mono text-[11px]">{demo.controlsHint}</span>
        </div>

        {/* Right Controls: Prev/Next and Info Toggle */}
        <div className="flex items-center gap-2">
          {/* Navigation buttons */}
          <div className="flex items-center bg-zinc-900 rounded-xl border border-zinc-800 p-0.5">
            <TransitionLink
              href={`/demo/${prevDemo.id}`}
              transitionType="backward"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={`Previous: ${prevDemo.title}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </TransitionLink>
            <span className="text-[11px] font-mono text-zinc-500 px-1.5">
              {demoIndex + 1}/{DEMOS.length}
            </span>
            <TransitionLink
              href={`/demo/${nextDemo.id}`}
              transitionType="forward"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title={`Next: ${nextDemo.title}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </TransitionLink>
          </div>

          {/* Info toggle */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
              showInfo
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                : "bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200"
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="hidden sm:inline">Info</span>
          </button>
        </div>
      </header>

      {/* Full Viewport Canvas */}
      <main className="relative flex-1 w-full h-full bg-black overflow-hidden vt-hero">
        <DemoComponent />

        {/* Mobile Controls Hint Banner (Bottom) */}
        <div className="md:hidden absolute bottom-4 inset-x-4 pointer-events-none flex justify-center z-10">
          <div className="px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-xs font-mono text-zinc-300 text-center shadow-lg">
            {demo.controlsHint}
          </div>
        </div>

        {/* Side Info Panel / Drawer */}
        {showInfo && (
          <aside className="absolute top-4 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 max-h-[calc(100vh-6rem)] overflow-y-auto z-40 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">
                  Shader Details
                </span>
                <h2 className="text-lg font-bold text-white">{demo.title}</h2>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                aria-label="Close shader details"
                className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed mb-4">
              {demo.description}
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1.5">
                  Pipeline & Tech Tags
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {demo.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                  Interaction Model
                </span>
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 font-mono">
                  {demo.controlsHint}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 block mb-1">
                  WebGPU Engine
                </span>
                <p className="text-[11px] text-zinc-400">
                  vgpu v0.3.1 • Zero-overhead command encoder • Native WGSL module reflection.
                </p>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
