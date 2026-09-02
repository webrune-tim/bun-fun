import GUI from "lil-gui";
import { clock, effect, frameLoop, surface, type Gpu, type Surface } from "vgpu";
import liquidGlassWgsl from "./liquid-glass.wgsl";

interface RendererOptions {
  readonly canvas: HTMLCanvasElement;
}

export interface LiquidGlassSettings {
  theme: number;
  ior: number;
  dispersion: number;
  thickness: number;
  viscosity: number;
  roughness: number;
  specular: number;
  glassWindow: boolean;
  dockVisible: boolean;
}

const DEFAULT_SETTINGS: LiquidGlassSettings = {
  theme: 0,
  ior: 1.48,
  dispersion: 0.045,
  thickness: 1.1,
  viscosity: 0.25,
  roughness: 0.12,
  specular: 1.3,
  glassWindow: true,
  dockVisible: true,
};

export function createRenderer({ canvas }: RendererOptions) {
  let disposed = false;
  let gpu: Gpu | undefined;
  let canvasSurface: Surface | undefined;
  let glassEffect: ReturnType<typeof effect> | undefined;
  let loop: { stop(): void } | undefined;
  let gui: GUI | undefined;
  let observer: ResizeObserver | undefined;

  const settings: LiquidGlassSettings = { ...DEFAULT_SETTINGS };

  // Pointer state in normalized UV space [0..1]
  let targetPointer = [0.5, 0.5];
  let currentPointer = [0.5, 0.5];
  let pointerVelocity = [0, 0];
  let lastPointer = [0.5, 0.5];
  let lastPointerTime = performance.now();

  const onPointerMove = (e: MouseEvent | Touch) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height; // WebGPU Y is up

    targetPointer = [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];

    const now = performance.now();
    const dt = Math.max(0.001, (now - lastPointerTime) / 1000);
    pointerVelocity = [
      (targetPointer[0] - lastPointer[0]) / dt,
      (targetPointer[1] - lastPointer[1]) / dt,
    ];
    lastPointer = [...targetPointer];
    lastPointerTime = now;
  };

  const handleMouseMove = (e: MouseEvent) => onPointerMove(e);
  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) onPointerMove(e.touches[0]);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    loop?.stop();
    observer?.disconnect();
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("touchmove", handleTouchMove);
    gui?.destroy();
    canvasSurface?.dispose();
    gpu?.dispose();
  };

  const initialize = async () => {
    const { init } = await import("vgpu");
    if (disposed) return;

    const nextGpu = await init();
    if (disposed) {
      nextGpu.dispose();
      return;
    }
    gpu = nextGpu;

    canvasSurface = surface(gpu, canvas);
    glassEffect = effect(gpu, liquidGlassWgsl);

    // Add pointer listeners
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });

    // Build lil-gui controls
    gui = new GUI({
      title: "macOS 27 Liquid Glass",
      container: canvas.parentElement ?? undefined,
      width: 230,
    });
    Object.assign(gui.domElement.style, {
      position: "absolute",
      top: "16px",
      right: "16px",
      zIndex: "20",
    });

    gui
      .add(settings, "theme", {
        "Sequoia Aurora": 0,
        "Tahoe Glacier": 1,
        "Obsidian Cyber": 2,
        "Solar Flare": 3,
      })
      .name("Wallpaper");

    const opticsFolder = gui.addFolder("Glass Optics");
    opticsFolder.add(settings, "ior", 1.0, 2.4, 0.01).name("Refraction (IOR)");
    opticsFolder.add(settings, "dispersion", 0.0, 0.12, 0.005).name("Dispersion");
    opticsFolder.add(settings, "thickness", 0.1, 3.0, 0.1).name("Thickness");
    opticsFolder.add(settings, "roughness", 0.02, 0.6, 0.01).name("Roughness");
    opticsFolder.add(settings, "specular", 0.0, 2.5, 0.1).name("Specular");

    const fluidFolder = gui.addFolder("Fluid Dynamics");
    fluidFolder.add(settings, "viscosity", 0.0, 1.0, 0.05).name("Viscosity");

    const uiFolder = gui.addFolder("macOS UI Layer");
    uiFolder.add(settings, "glassWindow").name("Finder Window");
    uiFolder.add(settings, "dockVisible").name("Liquid Dock");

    const timer = clock(gpu);

    loop = frameLoop(gpu, (f) => {
      if (disposed || !canvasSurface || !glassEffect) return;

      // Smooth pointer interpolation
      currentPointer[0] += (targetPointer[0] - currentPointer[0]) * 0.18;
      currentPointer[1] += (targetPointer[1] - currentPointer[1]) * 0.18;

      // Velocity damping
      pointerVelocity[0] *= 0.92;
      pointerVelocity[1] *= 0.92;

      const [w, h] = canvasSurface.size;

      glassEffect.set({
        params: {
          resolution: [w, h],
          pointer: currentPointer,
          pointerVelocity: pointerVelocity,
          time: timer.time,
          ior: settings.ior,
          dispersion: settings.dispersion,
          thickness: settings.thickness,
          viscosity: settings.viscosity,
          roughness: settings.roughness,
          theme: settings.theme,
          glassWindow: settings.glassWindow ? 1.0 : 0.0,
          dockVisible: settings.dockVisible ? 1.0 : 0.0,
          specular: settings.specular,
          padding: 0.0,
        },
      });

      f.pass(canvasSurface, glassEffect);
    });
  };

  const ready = initialize().catch((err) => {
    if (disposed) return;
    console.error("Failed to initialize MacOS 27 Liquid Glass renderer:", err);
  });

  return { ready, dispose };
}
