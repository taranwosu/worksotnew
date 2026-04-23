/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1A1A1A",
          2: "#262626",
          3: "#3a3a3a",
          60: "rgba(26,26,26,0.60)",
          40: "rgba(26,26,26,0.40)",
          20: "rgba(26,26,26,0.20)",
          12: "rgba(26,26,26,0.12)",
          10: "rgba(26,26,26,0.10)",
          8: "rgba(26,26,26,0.08)",
        },
        cream: {
          DEFAULT: "#FFF7EE",
          2: "#FBEEDB",
          3: "#F4E4C9",
        },
        sun: {
          DEFAULT: "#FFC13B",
          2: "#F5A623",
          soft: "#FFE7A8",
        },
        sand: "#EFE6D6",
        paper: "#FAF5EC",
        moss: "#2F4A3A",
        rust: "#B6442A",
        plum: "#3A2341",
      },
      fontFamily: {
        sans: ["Geist", "Neue Haas Grotesk", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
        display: ["Geist", "Neue Haas Grotesk Display", "sans-serif"],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "8px",
        xl: "12px",
        pill: "999px",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 0.61, 0.36, 1)",
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
