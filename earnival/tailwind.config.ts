import type { Config } from "tailwindcss";

/**
 * Brand tokens carried over from the v2 prototype so the production build
 * keeps the visual identity the founder already validated.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#1C1030",
        flame: "#FF5E1A",
        marigold: "#FFB020",
        plum: "#5B2A9E",
        paper: "#FAF6EF",
        line: "#E9E2D6",
        mute: "#6E6578",
        leaf: "#1F6F44",
        haze: "#F0EAE0",
        fog: "#B9AFC6",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
