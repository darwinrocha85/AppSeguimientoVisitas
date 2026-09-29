import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  /* Sitio web adaptable e instalable como PWA (no app nativa de tienda) */
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
