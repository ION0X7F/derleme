import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      {
        source: "/reports/:id",
        destination: "/report/:id",
        permanent: true,
      },
      {
        source: "/reports/:id/export",
        destination: "/report/:id/export",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
