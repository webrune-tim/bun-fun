struct Params {
  resolution: vec2f,
  pointer: vec2f,
  pointerVelocity: vec2f,
  time: f32,
  ior: f32,
  dispersion: f32,
  thickness: f32,
  viscosity: f32,
  roughness: f32,
  theme: f32,
  glassWindow: f32,
  dockVisible: f32,
  specular: f32,
  padding: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

// Simplex 2D noise helpers
fn permute(x: vec4f) -> vec4f {
  return ((x * 34.0) + 1.0) * x % 289.0;
}

fn snoise(v: vec2f) -> f32 {
  let C = vec4f(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  var i = floor(v + dot(v, C.yy));
  let x0 = v - i + dot(i, C.xx);
  var i1 = vec2f(0.0);
  if (x0.x > x0.y) {
    i1 = vec2f(1.0, 0.0);
  } else {
    i1 = vec2f(0.0, 1.0);
  }
  let x12 = x0.xyxy + C.xxzz - vec4f(i1, 0.0, 0.0);
  i = i % 289.0;
  let p = permute(permute(i.y + vec4f(0.0, i1.y, 1.0, 0.0)) + i.x + vec4f(0.0, i1.x, 1.0, 0.0));
  var m = max(0.5 - vec3f(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3f(0.0));
  m = m * m;
  m = m * m;
  let x = 2.0 * fract(p.xyz * C.www) - 1.0;
  let h = abs(x) - 0.5;
  let ox = floor(x + 0.5);
  let a0 = x - ox;
  m = m * (1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h));
  var g = vec3f(0.0);
  g.x = a0.x * x0.x + h.x * x0.y;
  g.y = a0.y * x12.x + h.y * x12.y;
  g.z = a0.z * x12.z + h.z * x12.w;
  return 130.0 * dot(m, g);
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var shift = vec2f(100.0);
  var pos = p;
  for (var i = 0; i < 4; i++) {
    v += a * snoise(pos);
    pos = pos * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// Rounded box SDF
fn sdRoundedBox(p: vec2f, b: vec2f, r: vec4f) -> f32 {
  var rad = r;
  if (p.x <= 0.0) {
    if (p.y > 0.0) { rad.x = rad.w; } else { rad.x = rad.z; }
  } else {
    if (p.y <= 0.0) { rad.x = rad.y; }
  }
  let q = abs(p) - b + rad.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - rad.x;
}

// Procedural macOS 27 Desktop Wallpaper
fn sampleWallpaper(uv: vec2f, time: f32, themeIdx: f32) -> vec3f {
  let aspect = params.resolution.x / params.resolution.y;
  let p = (uv - 0.5) * vec2f(aspect, 1.0);
  let t = time * 0.15;

  let n1 = fbm(p * 1.5 + vec2f(cos(t * 0.4), sin(t * 0.3)) * 0.5);
  let n2 = fbm(p * 2.5 + vec2f(-sin(t * 0.5), cos(t * 0.6)) * 0.6 + n1 * 0.8);
  let n3 = fbm(p * 3.5 + n2 * 1.2 + vec2f(t * 0.2, -t * 0.15));

  var col = vec3f(0.0);

  if (themeIdx < 0.5) {
    // Theme 0: macOS 27 Sequoia Aurora (Indigo / Peach / Turquoise)
    let c0 = vec3f(0.04, 0.05, 0.12);
    let c1 = vec3f(0.32, 0.15, 0.65);
    let c2 = vec3f(0.95, 0.45, 0.55);
    let c3 = vec3f(0.12, 0.85, 0.85);

    col = mix(c0, c1, smoothstep(-0.6, 0.4, n1));
    col = mix(col, c2, smoothstep(-0.2, 0.8, n2) * 0.75);
    col = mix(col, c3, smoothstep(0.1, 0.9, n3) * 0.6);
  } else if (themeIdx < 1.5) {
    // Theme 1: Tahoe Hyper-Glacier (Cobalt / Cyan / Prismatic Ice)
    let c0 = vec3f(0.02, 0.08, 0.18);
    let c1 = vec3f(0.05, 0.35, 0.75);
    let c2 = vec3f(0.15, 0.85, 0.95);
    let c3 = vec3f(0.90, 0.98, 1.00);

    col = mix(c0, c1, smoothstep(-0.5, 0.5, n1));
    col = mix(col, c2, smoothstep(-0.1, 0.7, n2));
    col = mix(col, c3, smoothstep(0.3, 0.95, n3) * 0.8);
  } else if (themeIdx < 2.5) {
    // Theme 2: Obsidian Cyberpunk (Carbon / Emerald / Violet)
    let c0 = vec3f(0.01, 0.01, 0.03);
    let c1 = vec3f(0.20, 0.05, 0.35);
    let c2 = vec3f(0.05, 0.75, 0.45);
    let c3 = vec3f(0.65, 0.15, 0.95);

    col = mix(c0, c1, smoothstep(-0.6, 0.3, n1));
    col = mix(col, c2, smoothstep(0.0, 0.7, n2) * 0.7);
    col = mix(col, c3, smoothstep(0.2, 0.9, n3) * 0.8);
  } else {
    // Theme 3: Solar Plasma Flare (Amber / Gold / Crimson)
    let c0 = vec3f(0.08, 0.02, 0.04);
    let c1 = vec3f(0.55, 0.08, 0.22);
    let c2 = vec3f(0.95, 0.45, 0.10);
    let c3 = vec3f(1.00, 0.88, 0.35);

    col = mix(c0, c1, smoothstep(-0.5, 0.5, n1));
    col = mix(col, c2, smoothstep(-0.1, 0.7, n2));
    col = mix(col, c3, smoothstep(0.2, 0.9, n3) * 0.85);
  }

  // Add subtle star-dust and vignette
  let vig = 1.0 - length(p * 0.6) * 0.6;
  return col * max(vig, 0.2);
}

// Compute fluid wave height
fn getWaveHeight(uv: vec2f, time: f32) -> f32 {
  let aspect = params.resolution.x / params.resolution.y;
  let p = (uv - 0.5) * vec2f(aspect, 1.0);
  let ptr = (params.pointer - 0.5) * vec2f(aspect, 1.0);

  // Distance to cursor
  let distToPtr = length(p - ptr);
  
  // Interactive ripple pulse centered at pointer
  let rippleFreq = 30.0;
  let rippleDecay = exp(-distToPtr * 8.0 * (1.0 + params.viscosity));
  let cursorRipple = sin(distToPtr * rippleFreq - time * 6.0) * rippleDecay * 0.035;

  // Pointer velocity wake
  let velMag = length(params.pointerVelocity);
  let velDir = normalize(params.pointerVelocity + vec2f(0.0001));
  let wakeProj = dot(p - ptr, velDir);
  let wake = exp(-distToPtr * 5.0) * sin(wakeProj * 20.0 - time * 8.0) * min(velMag * 0.08, 0.04);

  // Autonomous ambient fluid undulations
  let t = time * 1.2;
  let wave1 = sin(p.x * 4.0 + p.y * 3.0 + t) * 0.012;
  let wave2 = cos(p.x * 7.0 - p.y * 5.0 + t * 1.3) * 0.008;
  let wave3 = sin(length(p) * 6.0 - t * 1.5) * 0.006;

  // macOS Window boundary fluid surface tension
  var uiDist = 999.0;
  if (params.glassWindow > 0.5) {
    let winPos = p - vec2f(0.0, 0.02);
    uiDist = sdRoundedBox(winPos, vec2f(0.55, 0.32), vec4f(0.04));
  }
  let meniscus = exp(-abs(uiDist) * 35.0) * 0.018;

  return cursorRipple + wake + (wave1 + wave2 + wave3) * (1.0 - params.viscosity * 0.5) + meniscus;
}

// Calculate normal via central differences
fn getWaveNormal(uv: vec2f, time: f32) -> vec3f {
  let eps = 0.003;
  let hL = getWaveHeight(uv - vec2f(eps, 0.0), time);
  let hR = getWaveHeight(uv + vec2f(eps, 0.0), time);
  let hD = getWaveHeight(uv - vec2f(0.0, eps), time);
  let hU = getWaveHeight(uv + vec2f(0.0, eps), time);

  let dHdx = (hR - hL) / (2.0 * eps);
  let dHdy = (hU - hD) / (2.0 * eps);

  return normalize(vec3f(-dHdx * 4.0, -dHdy * 4.0, 1.0));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.resolution.x / params.resolution.y;
  let p = (uv - 0.5) * vec2f(aspect, 1.0);
  let time = params.time;

  // Fluid normal
  let normal = getWaveNormal(uv, time);
  let viewDir = vec3f(0.0, 0.0, 1.0);

  // Snell's Law Chromatic Refraction
  let iorBase = max(1.05, params.ior);
  let disp = params.dispersion * 0.6;
  let iorR = iorBase - disp;
  let iorG = iorBase;
  let iorB = iorBase + disp;

  // Refract view vectors
  let refrR = refract(-viewDir, normal, 1.0 / iorR);
  let refrG = refract(-viewDir, normal, 1.0 / iorG);
  let refrB = refract(-viewDir, normal, 1.0 / iorB);

  let thick = params.thickness * 0.08;
  let uvR = uv + refrR.xy * thick;
  let uvG = uv + refrG.xy * thick;
  let uvB = uv + refrB.xy * thick;

  // Sample wallpaper with dispersed chromatic channels
  let colR = sampleWallpaper(uvR, time, params.theme).r;
  let colG = sampleWallpaper(uvG, time, params.theme).g;
  let colB = sampleWallpaper(uvB, time, params.theme).b;
  var color = vec3f(colR, colG, colB);

  // Caustics & Convergence Brightness
  let divNorm = (refrR.x - refrB.x) + (refrR.y - refrB.y);
  let caustics = max(0.0, divNorm * 25.0);
  color += vec3f(1.0, 0.95, 0.85) * caustics * 0.4;

  // Fresnel Reflection
  let cosTheta = max(dot(viewDir, normal), 0.0);
  let f0 = pow((iorBase - 1.0) / (iorBase + 1.0), 2.0);
  let fresnel = f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);

  // Specular Highlights (Key Light + Fill Light)
  let keyLight = normalize(vec3f(0.6, 0.8, 1.2));
  let fillLight = normalize(vec3f(-0.7, -0.4, 0.8));

  let halfKey = normalize(keyLight + viewDir);
  let halfFill = normalize(fillLight + viewDir);

  let specKey = pow(max(dot(normal, halfKey), 0.0), 90.0 / (params.roughness + 0.05));
  let specFill = pow(max(dot(normal, halfFill), 0.0), 40.0 / (params.roughness + 0.05));

  let specCol = vec3f(1.0, 1.0, 1.0) * specKey * 1.5 + vec3f(0.7, 0.85, 1.0) * specFill * 0.6;
  color += specCol * params.specular * (fresnel + 0.15);

  // ==========================================
  // macOS 27 FLOATING GLASS UI RENDERING
  // ==========================================
  if (params.glassWindow > 0.5) {
    let winCenter = vec2f(0.0, 0.02);
    let winP = p - winCenter;
    let winSize = vec2f(0.52, 0.30);
    let cornerRad = 0.035;
    let dWin = sdRoundedBox(winP, winSize, vec4f(cornerRad));

    if (dWin < 0.0) {
      // Inside macOS Glass Window
      let innerMask = smoothstep(0.0, -0.005, dWin);
      
      // Frosted Glass Tint & Luminance Boost
      let glassTint = vec3f(0.12, 0.15, 0.22);
      let glassLuminance = vec3f(0.06);
      color = mix(color, color * 0.85 + glassTint + glassLuminance, 0.55 * innerMask);

      // Glass Bevel Specular Rim (Top Edge Glint)
      let bevel = smoothstep(-0.008, 0.0, dWin) * smoothstep(0.002, 0.0, dWin);
      let topGlint = max(0.0, -winP.y / winSize.y) * 0.6 + 0.4;
      color += vec3f(0.8, 0.9, 1.0) * bevel * topGlint * 1.2;

      // Window Header Bar Line
      let headerY = winP.y - (winSize.y - 0.06);
      if (abs(headerY) < 0.0015) {
        color += vec3f(0.3, 0.35, 0.45);
      }

      // Traffic Light Buttons (Close, Minimize, Expand)
      let btnY = winSize.y - 0.03;
      let btnR = 0.010;
      let btn1P = winP - vec2f(-winSize.x + 0.04, btnY);
      let btn2P = winP - vec2f(-winSize.x + 0.075, btnY);
      let btn3P = winP - vec2f(-winSize.x + 0.11, btnY);

      let dBtn1 = length(btn1P) - btnR;
      let dBtn2 = length(btn2P) - btnR;
      let dBtn3 = length(btn3P) - btnR;

      if (dBtn1 < 0.0) {
        color = mix(color, vec3f(1.0, 0.35, 0.35), 0.9);
      }
      if (dBtn2 < 0.0) {
        color = mix(color, vec3f(1.0, 0.78, 0.25), 0.9);
      }
      if (dBtn3 < 0.0) {
        color = mix(color, vec3f(0.25, 0.85, 0.45), 0.9);
      }

      // Frosted Glass Search Pill
      let searchP = winP - vec2f(0.0, btnY);
      let dSearch = sdRoundedBox(searchP, vec2f(0.12, 0.016), vec4f(0.008));
      if (dSearch < 0.0) {
        color += vec3f(0.08, 0.10, 0.15);
      }

      // Sleek Sidebar Division
      let sideX = winP.x - (-winSize.x + 0.16);
      if (abs(sideX) < 0.001 && winP.y < btnY - 0.02) {
        color += vec3f(0.15, 0.18, 0.25);
      }
    } else {
      // Window Exterior Drop Shadow
      let shadowDist = sdRoundedBox(winP - vec2f(0.0, -0.03), winSize + vec2f(0.02), vec4f(cornerRad + 0.02));
      let shadow = smoothstep(0.12, 0.0, shadowDist) * 0.45;
      color = mix(color, color * 0.4, shadow);
    }
  }

  // ==========================================
  // macOS 27 FLOATING GLASS DOCK
  // ==========================================
  if (params.dockVisible > 0.5) {
    let dockY = -0.42;
    let dockP = p - vec2f(0.0, dockY);
    let dockSize = vec2f(0.38, 0.038);
    let dDock = sdRoundedBox(dockP, dockSize, vec4f(0.02));

    if (dDock < 0.0) {
      // Glass Dock Base
      color = mix(color, color * 0.75 + vec3f(0.15, 0.18, 0.26), 0.7);

      // Glass Edge Rim
      let dockBevel = smoothstep(-0.004, 0.0, dDock);
      color += vec3f(0.6, 0.75, 0.95) * dockBevel * 0.8;

      // Dock App Icons (8 liquid glass app icons)
      for (var i = -3; i <= 4; i++) {
        let iconX = f32(i) * 0.048 - 0.024;
        let iconP = dockP - vec2f(iconX, 0.0);
        let dIcon = sdRoundedBox(iconP, vec2f(0.016, 0.016), vec4f(0.006));
        if (dIcon < 0.0) {
          let iconHue = f32(i + 4) * 0.14;
          let iconCol = 0.5 + 0.5 * cos(6.28318 * (iconHue + vec3f(0.0, 0.33, 0.67)));
          color = mix(color, iconCol, 0.85);
          // Glint
          if (iconP.y > 0.005) { color += vec3f(0.2); }
        }
      }
    } else {
      // Dock Shadow
      let dockShadow = smoothstep(0.08, 0.0, sdRoundedBox(dockP - vec2f(0.0, -0.015), dockSize + vec2f(0.01), vec4f(0.03))) * 0.5;
      color = mix(color, color * 0.3, dockShadow);
    }
  }

  // ==========================================
  // macOS 27 TOP GLASS MENU BAR
  // ==========================================
  let topBarP = p - vec2f(0.0, 0.48);
  if (topBarP.y > -0.02) {
    color = mix(color, color * 0.7 + vec3f(0.10, 0.12, 0.18), 0.65);
    // Menu bar bottom separator line
    if (abs(topBarP.y + 0.02) < 0.001) {
      color += vec3f(0.2, 0.25, 0.35);
    }
  }

  return vec4f(color, 1.0);
}
