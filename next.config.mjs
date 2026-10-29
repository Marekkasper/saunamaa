/** @type {import('next').NextConfig} */
const nextConfig = {
  // The knowledge base CSV is read at runtime from /data
  outputFileTracingIncludes: { "/api/**": ["./data/**"] },
};
export default nextConfig;
