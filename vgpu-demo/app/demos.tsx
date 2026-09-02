import React from "react";
import {
  AgentRadianceCascades,
  AntiAliasing,
  BatchRendering,
  BlackHole,
  Clipping,
  ColorWheel,
  Earth,
  EnvironmentMap,
  FftOcean,
  FftOceanSurface,
  Fluid,
  GlassFractal,
  InstancedRendering,
  MacOsLiquidGlass,
  NextjsFlare,
  OptimizedBlackHole,
  RadianceCascades,
  RaymarchedFractal,
  Surface,
  Transmission,
  TriangleLedHero,
} from "@/app/components";

export type Category = "raymarching" | "lighting" | "simulation" | "rendering";

export interface DemoItem {
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  description: string;
  tags: string[];
  controlsHint: string;
  Component: React.ComponentType;
}

export const DEMOS: DemoItem[] = [
  {
    id: "macos-liquid-glass",
    title: "macOS 27 Liquid Glass",
    subtitle: "Prismatic Fluid Optics & Desktop UI",
    category: "lighting",
    description:
      "Concept macOS 27 liquid retina glass desktop with dynamic wallpaper auroras, Snell's law refraction, multi-spectral chromatic dispersion, reactive cursor wakes, and frosted glass UI elements.",
    tags: ["Prismatic Dispersion", "Snell's Law IOR", "Frosted Glass SDF", "Fluid Wake", "lil-gui Controls"],
    controlsHint: "Move cursor to create fluid wakes & inspect glass refraction via GUI",
    Component: MacOsLiquidGlass,
  },
  {
    id: "opt-blackhole",
    title: "Optimized Black Hole",
    subtitle: "Multi-pass Relativistic Raytracer",
    category: "raymarching",
    description:
      "High-performance geodesic raymarcher with animated accretion disk, precomputed G-buffer refinement, volumetric Doppler shift, and multi-stage bloom.",
    tags: ["Relativistic Geodesics", "Bloom Pass", "G-Buffer", "Interactive Camera"],
    controlsHint: "Click & drag on canvas to orbit camera",
    Component: OptimizedBlackHole,
  },
  {
    id: "triangle-led",
    title: "Triangle LED Hero",
    subtitle: "Analytic Edge Radiance & Floor Bounce",
    category: "lighting",
    description:
      "72 edge-mounted LED emitters with closed-form analytic raycast lighting, dynamic floor normal grain, and interactive pointer glow brushes.",
    tags: ["Analytic Raycast", "lil-gui Controls", "Floor Diffusion", "Pointer Reactive"],
    controlsHint: "Hover & drag pointer near edges, or use top-right mode menu",
    Component: TriangleLedHero,
  },
  {
    id: "earth",
    title: "Procedural Earth",
    subtitle: "HDR Atmosphere & Planet Baker",
    category: "lighting",
    description:
      "Procedural planet with GPU-baked albedo, city night lights, dynamic cloud shadows, Rayleigh/Mie atmospheric scattering, and solar flare bloom.",
    tags: ["Atmospheric Scattering", "Cloud Layer", "Solar Bloom", "Orbit Controls"],
    controlsHint: "Drag to rotate Earth, scroll to zoom, use top-right GUI",
    Component: Earth,
  },
  {
    id: "fluid",
    title: "Interactive Fluid Simulation",
    subtitle: "Navier-Stokes Compute Grid",
    category: "simulation",
    description:
      "Real-time Eulerian fluid dynamics solved via WebGPU compute passes: advection, pressure Poisson Jacobi iteration, and vorticity confinement.",
    tags: ["Compute Shaders", "Navier-Stokes", "Pressure Solve", "Velocity Field"],
    controlsHint: "Click and drag to inject dye and momentum",
    Component: Fluid,
  },
  {
    id: "nextjs-flare",
    title: "Next.js Volumetric Flare",
    subtitle: "48-Step Blue Noise Raymarch",
    category: "raymarching",
    description:
      "Rim-lit Next.js logo with volumetric atmospheric scattering: a 48-step ray walk jittered by blue noise over a separable Gaussian blur chain.",
    tags: ["Volumetric Scatter", "Blue Noise", "Separable Blur", "Breathing Motion"],
    controlsHint: "Move pointer to direct light source",
    Component: NextjsFlare,
  },
  {
    id: "radiance-cascades",
    title: "Radiance Cascades 2D",
    subtitle: "Global Illumination in Flatland",
    category: "lighting",
    description:
      "Hierarchical angular radiance cascades computing instant real-time indirect diffuse and specular light bounce across complex 2D scene geometry.",
    tags: ["Radiance Cascades", "Global Illumination", "Indirect Bounce", "Multi-Pass"],
    controlsHint: "Drag light sources and obstacles around canvas, use GUI",
    Component: RadianceCascades,
  },
  {
    id: "agent-radiance-cascades",
    title: "Agent Radiance Cascades",
    subtitle: "Jump-Flooded HDR Emitter Field",
    category: "lighting",
    description:
      "Interactive 10-dot Agent mark loading field: each dot acts as an HDR emitter and geometric occluder feeding 6 top-down radiance cascades.",
    tags: ["Jump Flood SDF", "HDR Emitters", "6-Cascade Solve", "Interactive Mode"],
    controlsHint: "Select modes & tweak capture controls in top-right GUI",
    Component: AgentRadianceCascades,
  },
  {
    id: "raymarched-fractal",
    title: "Raymarched Sierpinski",
    subtitle: "Distance-Estimated 3D Fractal",
    category: "raymarching",
    description:
      "Folded IFS 3D fractal rendered with sphere tracing, analytic distance estimator normals, soft ambient occlusion, and specular highlight bloom.",
    tags: ["Sphere Tracing", "Sierpinski IFS", "Distance Estimator", "Ambient Occlusion"],
    controlsHint: "Drag to rotate fractal camera angle",
    Component: RaymarchedFractal,
  },
  {
    id: "glass-fractal",
    title: "Glass Frosted Fractal",
    subtitle: "Refraction & Rough Transmission",
    category: "lighting",
    description:
      "Physically-modeled rough dielectric glass material transmitting and refracting internal fractal geometric caustics with chromatic dispersion.",
    tags: ["Rough Dielectrics", "Refraction", "Chromatic Aberration", "Caustics"],
    controlsHint: "Click and drag to orbit camera around glass, use GUI",
    Component: GlassFractal,
  },
  {
    id: "fft-ocean-surface",
    title: "FFT Ocean Surface",
    subtitle: "Tessendorf Spectrum Simulation",
    category: "simulation",
    description:
      "Statistical ocean wave model driven by inverse fast Fourier transforms (IFFT) on the GPU, calculating Phillips spectrum displacement and foam maps.",
    tags: ["Tessendorf FFT", "Phillips Spectrum", "Jacobian Foam", "Sun Specular"],
    controlsHint: "Orbit camera to view waves, tweak parameters in GUI",
    Component: FftOceanSurface,
  },
  {
    id: "fft-ocean",
    title: "FFT Ocean Particles",
    subtitle: "GPU Particle Wave Advection",
    category: "simulation",
    description:
      "Hundreds of thousands of compute-driven particles advected by underlying 3D ocean displacement fields, glowing with depth-based luminance.",
    tags: ["GPU Particles", "Compute Advection", "Point Sprites", "Depth Fade"],
    controlsHint: "Drag to change perspective over particle swarm",
    Component: FftOcean,
  },
  {
    id: "environment-map",
    title: "Equirectangular Environment",
    subtitle: "Image-Based Lighting & Reflections",
    category: "lighting",
    description:
      "Full 360° HDR equirectangular panorama lighting floating mirror-metal geometry with roughness mip-mapping and Fresnel reflectance.",
    tags: ["IBL Lighting", "Equirectangular HDR", "Fresnel Conductor", "Roughness Mips"],
    controlsHint: "Orbit to inspect metallic specular reflections",
    Component: EnvironmentMap,
  },
  {
    id: "transmission",
    title: "Thin Transmission & Absorption",
    subtitle: "Beer-Lambert Color Filtration",
    category: "lighting",
    description:
      "Translucent colored volumetric slabs filtering background light via Beer-Lambert absorption and smooth thickness-dependent diffusion.",
    tags: ["Beer-Lambert Law", "Volumetric Absorption", "Color Filter", "HDR Tone"],
    controlsHint: "Drag to rotate slabs, tweak thickness in GUI",
    Component: Transmission,
  },
  {
    id: "blackhole-classic",
    title: "Volumetric Black Hole",
    subtitle: "ACES-Tonemapped Accretion Disk",
    category: "raymarching",
    description:
      "Full volumetric smoke and thermal radiation sampling around a Schwarzschild metric horizon, integrated with a procedural stellar background.",
    tags: ["Volumetric March", "ACES Tonemap", "9-Tap Gaussian Blur", "Dual Bloom"],
    controlsHint: "Click & drag on canvas to rotate perspective",
    Component: BlackHole,
  },
  {
    id: "instanced-rendering",
    title: "125k Instanced Cubes",
    subtitle: "High-Throughput Vertex Streaming",
    category: "rendering",
    description:
      "125,000 independently animated 3D cubes rendered in a single draw call via GPU instance buffer streaming and spatial sine displacement.",
    tags: ["Instance Streams", "Single Draw Call", "125k Objects", "Stress Test"],
    controlsHint: "Tweak instance count & grid layout in GUI",
    Component: InstancedRendering,
  },
  {
    id: "batch-rendering",
    title: "Render Bundle Batching",
    subtitle: "Pre-Recorded GPU Command Streams",
    category: "rendering",
    description:
      "Demonstrates zero-overhead WebGPU GPURenderBundle replaying thousands of draw commands per frame with minimal CPU driver involvement.",
    tags: ["GPURenderBundle", "Command Replay", "Zero CPU Overhead", "Micro-Benchmark"],
    controlsHint: "Inspect frame pacing under high draw counts",
    Component: BatchRendering,
  },
  {
    id: "anti-aliasing",
    title: "Hardware & Post AA",
    subtitle: "MSAA 4×, SSAA 2×, & FXAA Comparison",
    category: "rendering",
    description:
      "Interactive comparative analysis of anti-aliasing techniques: evaluate hardware multisampling against spatial supersampling and Fast Approximate AA.",
    tags: ["MSAA 4×", "SSAA 2×", "FXAA Post", "Edge Analysis"],
    controlsHint: "Toggle AA modes in top-right GUI to compare edge crispness",
    Component: AntiAliasing,
  },
  {
    id: "clipping",
    title: "Geometric Plane Clipping",
    subtitle: "Multi-Plane Hardware Discard",
    category: "rendering",
    description:
      "Arbitrary 3D slicing planes cutting meshes in real time with interior cap color generation and dynamic plane orientation uniforms.",
    tags: ["Clip Planes", "Mesh Slicing", "Cap Generation", "Depth Stencil"],
    controlsHint: "Rotate and translate slicing plane through object",
    Component: Clipping,
  },
  {
    id: "gradient-surface",
    title: "WGSL Surface Gradient",
    subtitle: "Direct-to-Swapchain Shader",
    category: "rendering",
    description:
      "Core WebGPU fragment shader demonstrating zero-copy rendering into a dynamic canvas surface target with frame lifecycle management.",
    tags: ["Surface Swapchain", "WGSL Fragment", "Direct Pass", "Zero-Copy"],
    controlsHint: "Resizes reactively to container bounds",
    Component: Surface,
  },
  {
    id: "color-wheel",
    title: "Color Wheel",
    subtitle: "Modular Shader Palette & Polar Harmonics",
    category: "rendering",
    description:
      "Procedural polar chromatic wheel featuring modular WGSL shader imports, harmonic cosine color palettes, and exponential radial glow rings.",
    tags: ["Modular WGSL", "Cosine Palette", "Polar Harmonics", "vgpu Pipeline"],
    controlsHint: "Dynamically samples resolution and aspect ratio",
    Component: ColorWheel,
  },
];

export function getDemoById(id: string): DemoItem | undefined {
  return DEMOS.find((demo) => demo.id === id);
}

export function getAllDemoIds(): string[] {
  return DEMOS.map((demo) => demo.id);
}
