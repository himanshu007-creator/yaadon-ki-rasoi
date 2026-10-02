import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yaadon Ki Rasoi",
    short_name: "Yaadon Ki Rasoi",
    description: "Shazam for the taste of your childhood.",
    start_url: "/",
    display: "standalone",
    background_color: "#120a06",
    theme_color: "#120a06",
    lang: "en-IN",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
