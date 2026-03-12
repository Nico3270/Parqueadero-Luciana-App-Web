const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig = withBundleAnalyzer({
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.pixabay.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  
  
  reactStrictMode: true, // ✅ Mantiene el modo estricto en desarrollo
  productionBrowserSourceMaps: false, // ✅ No genera source maps en producción
  compress: true, // ✅ Activa compresión gzip/brotli para archivos estáticos
});

module.exports = nextConfig;
