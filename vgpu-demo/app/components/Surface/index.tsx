"use client";

import { useEffect, useRef } from "react";
import { init, effect, surface, frameLoop, type Gpu, type Surface as VgpuSurface } from "vgpu";
import gradientSource from "./gradient.wgsl";

interface Props {
  className?: string;
}

export default function Surface({ className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let loop: { stop(): void } | undefined;
    let canvasSurface: VgpuSurface | undefined;
    let gpu: Gpu | undefined;

    async function render() {
      if (!canvasRef.current) return;
      if (typeof navigator === "undefined" || !("gpu" in navigator)) {
        console.warn("WebGPU is not supported on this browser.");
        return;
      }

      try {
        const nextGpu = await init();
        if (disposed || !canvasRef.current) {
          nextGpu.dispose();
          return;
        }
        gpu = nextGpu;
        canvasSurface = surface(gpu, canvasRef.current);
        const gradient = effect(gpu, gradientSource);

        loop = frameLoop(gpu, (f) => {
          if (disposed || !canvasSurface) return;
          f.pass(canvasSurface, gradient);
        });
      } catch (err) {
        console.error("Failed to initialize vgpu surface:", err);
      }
    }

    render();

    return () => {
      disposed = true;
      loop?.stop();
      canvasSurface?.dispose();
      gpu?.dispose();
    };
  }, []);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
}