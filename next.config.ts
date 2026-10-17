import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['heic-decode'],
  // Vercel's instrumented CommonJS loader cannot require jose's ESM entry.
  // Bundle the Firebase verification dependency chain without downgrading JWT libraries.
  transpilePackages: ['firebase-admin', 'jwks-rsa', 'jose'],
  outputFileTracingIncludes: { '/api/vision-lab': ['./research/oral-vision/run_local.py'], '/api/screenings': ['./node_modules/heic-decode/**/*', './node_modules/libheif-js/**/*'] },
  experimental: {
    cpus: 1,
    memoryBasedWorkersCount: true,
  },
  async headers() { return [{ source: '/ort/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }]; },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify-file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
