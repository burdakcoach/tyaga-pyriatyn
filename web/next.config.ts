import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // @tyaga/db is a workspace package shipped as TypeScript source (no build step),
  // so it needs to be transpiled by Next.js like the rest of the app.
  transpilePackages: ["@tyaga/db"],
  serverExternalPackages: ["better-sqlite3"],
  // This is an npm-workspaces monorepo (web/ is not its own git repo) — pin the
  // Turbopack/webpack root explicitly so module resolution reaches the shared
  // root node_modules instead of stopping at web/.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
