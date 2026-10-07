import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/dang-ky',
        destination: '/tong-quan',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
