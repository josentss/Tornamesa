/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Cloudinary (avatars)
      { protocol: 'https', hostname: 'res.cloudinary.com' },

      // Spotify covers
      { protocol: 'https', hostname: 'i.scdn.co' },
      { protocol: 'https', hostname: 'mosaic.scdn.co' },
      { protocol: 'https', hostname: 'wrapped-images.spotifycdn.com' },
    ],
  },
};

module.exports = nextConfig;
