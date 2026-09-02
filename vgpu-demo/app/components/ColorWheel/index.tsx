"use client";

import { useEffect, useRef } from "react";
import { clock, effect, frameLoop, init, surface, type Gpu, type Surface } from "vgpu";
import shaderSource from "./main.wgsl";

export function createColorWheelRenderer(canvas: HTMLCanvasElement) {
  let disposed = false;
  let loop: { stop(): void } | undefined;
  let canvasSurface: Surface | undefined;
  let gpu: Gpu | undefined;

  async function start() {
    if (disposed) return;
    try {
      const nextGpu = await init();
      if (disposed) {
        nextGpu.dispose();
        return;
      }
      gpu = nextGpu;
      canvasSurface = surface(gpu, canvas, { dpr: 1 });
      const shader = effect(gpu, shaderSource);
      const timer = clock(gpu);

      loop = frameLoop(gpu, (f) => {
        if (disposed || !canvasSurface) return;
        const [w, h] = canvasSurface.size;
        if (w <= 0 || h <= 0) return;

        try {
          shader.set({
            uniforms: {
              resolution: [w, h],
              time: timer.time,
              pad: 0,
            },
          });
          f.pass(canvasSurface, shader);
        } catch {
          // Prevent runtime crash if canvas context becomes unconfigured during resize/unmount
        }
      });
    } catch (err) {
      if (!disposed) {
        console.error("Failed to initialize ColorWheel WebGPU effect:", err);
      }
    }
  }

  const ready = start();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loop?.stop();
    canvasSurface?.dispose();
    gpu?.dispose();
  };

  return { ready, dispose };
}

export async function render(canvas: HTMLCanvasElement) {
  const renderer = createColorWheelRenderer(canvas);
  await renderer.ready;
  return renderer.dispose;
}

export interface ColorWheelProps {
  className?: string;
}

export function ColorWheel({ className = "" }: ColorWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof navigator === "undefined" || !("gpu" in navigator)) {
      console.warn("WebGPU is not supported on this browser.");
      return;
    }

    const renderer = createColorWheelRenderer(canvas);

    return () => {
      renderer.dispose();
    };
  }, []);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
}

export default ColorWheel;
