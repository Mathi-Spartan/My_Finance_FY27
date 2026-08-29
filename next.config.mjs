/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf.js must resolve its own worker at runtime, so keep it out of the bundle
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist'],
    // the bundler cannot see these files, so tracing must be told to ship them
    outputFileTracingIncludes: {
      '/api/read-pdf': ['./node_modules/pdfjs-dist/legacy/build/**'],
    },
  },
  headers: async () => ([
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' }
      ]
    }
  ])
};
export default nextConfig;
