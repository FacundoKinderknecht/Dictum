import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        idm: "#dc2626",
      },
    },
  },
  plugins: [],
} satisfies Config;
