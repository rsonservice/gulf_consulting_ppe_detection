/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/processed-images/**",
      },
      {
        protocol: "http",
        hostname: "192.168.24.128",
        port: "8000",
        pathname: "/processed-images/**",
      },
      {
        protocol: "http",
        hostname: "18.191.195.85",
        port: "8000",
        pathname: "/processed-images/**",
      },
    ],
  },
};

export default nextConfig;
