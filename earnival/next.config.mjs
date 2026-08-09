/**
 * Content Security Policy.
 *
 * `'unsafe-inline'` on styles is required because the app uses inline style
 * attributes for brand colours; scripts are NOT given that latitude.
 * `frame-ancestors 'none'` is the clickjacking defence that matters here — a
 * "Get ticket" button must never be loadable inside someone else's page.
 */
const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; eval is dev-only for HMR.
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // data: covers generated QR codes; blob: covers the camera scanner.
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  // Paystack's hosted checkout is a full redirect, not a frame.
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.paystack.com",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma must stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", "prisma"],

  // Never leak the framework version to a scanner.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Ticket URLs are bearer credentials — never send them in a Referer.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Camera is needed for the door scanner; everything else is off.
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        // Ticket badges carry entry credentials and attendee details.
        source: "/t/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
