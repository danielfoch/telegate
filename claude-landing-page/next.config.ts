import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This app lives inside the telegate monorepo; pin the workspace root so
  // Turbopack ignores lockfiles above it.
  turbopack: { root: path.join(import.meta.dirname ?? __dirname) },
};

export default nextConfig;
