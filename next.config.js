/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "target.scene7.com" },
      { protocol: "https", hostname: "i5.walmartimages.com" },
      { protocol: "https", hostname: "images.thdstatic.com" },
      { protocol: "https", hostname: "mobileimages.lowes.com" },
    ],
  },
};
module.exports = nextConfig;
