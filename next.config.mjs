/** @type {import('next').NextConfig} */

// =============================================================================
// Environment Variable Validation
// =============================================================================
// Validate required environment variables at startup (build time and runtime)
// This prevents the application from starting with missing configuration

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
];

// Only validate in non-build environments (runtime)
// During build, env vars might not be available
if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE !== 'phase-production-build') {
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.error('\n❌ Missing required environment variables:');
    missingVars.forEach((envVar) => {
      console.error(`   - ${envVar}`);
    });
    console.error('\n📝 See .env.example for documentation.\n');
    
    // Only throw in development to prevent startup
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }
}

// Optional environment variables with defaults (logged for visibility)
const optionalEnvVars = {
  FAS_API_URL: 'http://158.42.167.56:8000/uplan',
};

if (process.env.NODE_ENV === 'development') {
  Object.entries(optionalEnvVars).forEach(([envVar, defaultValue]) => {
    if (!process.env[envVar]) {
      console.log(`ℹ️  ${envVar} not set, using default: ${defaultValue}`);
    }
  });
}

// =============================================================================
// Next.js Configuration
// =============================================================================
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // Relaxed CSP to allow Cesium to load tiles and imagery from external sources
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' data: https:; connect-src 'self' http: https: ws: wss:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; worker-src 'self' blob:;"
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
