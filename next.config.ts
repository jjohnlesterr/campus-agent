import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Events module was retired; old links and bookmarks land on Announcements.
  async redirects() {
    return [
      { source: "/admin/events", destination: "/admin/announcements", permanent: false },
      { source: "/admin/events/:path*", destination: "/admin/announcements", permanent: false },
      { source: "/app/events", destination: "/app/announcements", permanent: false },
    ];
  },
};

export default nextConfig;
