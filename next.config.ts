import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  distDir: process.env.SONRI_TEST_BUILD === '1' ? '.next-workflow' : '.next',
  serverExternalPackages: ['heic-decode', '@google-cloud/firestore'],
  // Vercel's instrumented CommonJS loader cannot require jose's ESM entry.
  // Bundle this dependency chain so authentication can initialize on Node 24.
  transpilePackages: ['firebase-admin', 'jwks-rsa', 'jose'],
  outputFileTracingIncludes: { '/api/screenings': ['./node_modules/heic-decode/**/*', './node_modules/libheif-js/**/*'] },
  experimental: {
    cpus: 1,
    memoryBasedWorkersCount: true,
  },
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
