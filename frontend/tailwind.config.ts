import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm "paper" background and near-black ink for an official-document feel.
        paper: "#faf9f6",
        ink: "#1c1b18",
        // Single deliberate accent: a deep institutional navy.
        accent: {
          50: "#eef2f8",
          100: "#d6e0ef",
          200: "#adc2df",
          300: "#7f9dc8",
          500: "#2c5a98",
          600: "#214a82",
          700: "#1b3d6b",
          800: "#163358",
          900: "#122a49",
        },
      },
      fontFamily: {
        // Serif for headings / wordmarks (official document); sans for body.
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
