/** @type {import('next').NextConfig} */
const nextConfig = {
  // The waitlist page used to be called Announcements; keep old links working.
  async redirects() {
    return [{ source: "/announcements", destination: "/early-access", permanent: true }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;
