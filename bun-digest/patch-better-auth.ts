import { readFileSync, writeFileSync, existsSync } from "node:fs";

const utilsPkgPath = "node_modules/@better-auth/utils/package.json";
if (existsSync(utilsPkgPath)) {
  try {
    const pkg = JSON.parse(readFileSync(utilsPkgPath, "utf-8"));
    if (pkg.exports?.["./password"]) {
      pkg.exports["./password"] = {
        import: "./dist/password.mjs",
        require: "./dist/password.cjs",
        default: "./dist/password.mjs",
      };
      writeFileSync(utilsPkgPath, JSON.stringify(pkg, null, 2) + "\n");
      console.log("[Patch] Normalized @better-auth/utils exports for serverless tracing");
    }
  } catch (err) {
    console.warn("[Patch Warning]:", err);
  }
}

const telemetryPkgPath = "node_modules/@better-auth/telemetry/package.json";
if (existsSync(telemetryPkgPath)) {
  try {
    const pkg = JSON.parse(readFileSync(telemetryPkgPath, "utf-8"));
    if (pkg.exports?.["."]) {
      pkg.exports["."] = {
        types: "./dist/index.d.mts",
        default: "./dist/index.mjs",
      };
      writeFileSync(telemetryPkgPath, JSON.stringify(pkg, null, 2) + "\n");
      console.log("[Patch] Normalized @better-auth/telemetry exports for serverless tracing");
    }
  } catch (err) {
    console.warn("[Patch Warning]:", err);
  }
}
