import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        paper: "#f7f8fb",
        thesis: "#315f72",
        sage: "#8aa08a",
        amberline: "#c8914b",
      },
      boxShadow: {
        panel: "0 18px 50px rgba(24, 33, 47, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
