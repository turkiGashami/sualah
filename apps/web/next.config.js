const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained Node server output for hosts with a Node runtime (cranl).
  output: "standalone",
  // Trace deps from the monorepo root so workspace files are bundled.
  experimental: { outputFileTracingRoot: path.join(__dirname, "../../") },
  // game-core is consumed as raw TS from the workspace.
  transpilePackages: ["@sealah/game-core"],
  webpack: (config) => {
    // Resolve the package's ".js" import specifiers to their ".ts" sources.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
};

module.exports = nextConfig;
