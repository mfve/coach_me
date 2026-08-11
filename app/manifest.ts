import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coach Me",
    short_name: "Coach Me",
    description: "Personal fitness tracking + AI training recommendations",
    start_url: "/",
    display: "standalone",
    background_color: "#16181A",
    theme_color: "#16181A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
