import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "T-Kit",
    short_name: "T-Kit",
    description: "Платформа для репетиторов",
    start_url: "/tutor",
    display: "standalone",
    orientation: "portrait",
    background_color: "#3D0C15",
    theme_color: "#5C1120",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
