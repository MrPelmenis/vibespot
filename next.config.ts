import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // The legacy app lives in the parent directory and has its own lockfile, so pin
  // the workspace root explicitly — otherwise Next walks up and gets confused.
  turbopack: {
    root: path.join(__dirname),
  },

  // `standalone` produces a self-contained server bundle, which is what the Ubuntu
  // deployment runs under systemd. Note: NOT `output: "export"` — spot pages must be
  // server-rendered, and a static export would recreate the empty-shell problem.
  output: "standalone",

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
