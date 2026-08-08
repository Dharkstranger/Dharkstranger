/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma must stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
