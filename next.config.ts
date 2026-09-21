import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both database drivers are native/WASM Node packages: PGlite ships a .wasm
  // payload and node-postgres resolves optional native bindings at runtime.
  // Bundling either one breaks those lookups, so they are required at runtime
  // from node_modules instead.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
