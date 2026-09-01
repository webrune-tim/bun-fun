"use client";

import { useEffect, useRef } from "react";
import { init, effect, surface, frame } from "vgpu";
import gradientSource from "./gradient.wgsl";

export default function Surface() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let active = true;

    async function render() {
      if (!canvasRef.current) return;
      if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        console.warn("WebGPU is not supported on this browser.");
        return;
      }

      try {
        const gpu = await init();
        if (!active || !canvasRef.current) return;

        const canvasSurface = surface(gpu, canvasRef.current);
        const gradient = effect(gpu, gradientSource);

        frame(gpu, (f) => {
          f.pass(canvasSurface, gradient);
        });
      } catch (err) {
        console.error("Failed to initialize vgpu:", err);
      }
    }

    render();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-2 my-4">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800"
      />
    </div>
  );
}