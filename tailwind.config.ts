import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: "#e0f2fe",
          DEFAULT: "#0ea5e9",
          dark: "#0284c7",
        },
      },
      fontFamily: {
        serif: ["'Noto Serif KR'", "serif"],
        sans: ["'Pretendard'", "system-ui", "sans-serif"],
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
          },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
