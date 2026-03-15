/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for Capacitor iOS builds
  // Comment out for Vercel deployment (Vercel handles this automatically)
  // output: 'export',

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
    ],
  },

  // Headers for video upload
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // Increase body size limit for video uploads (100MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
};

module.exports = nextConfig;
