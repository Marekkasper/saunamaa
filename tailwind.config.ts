import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm "ember" accent – the glow of sauna stones
        ember: {
          50: "#fff6ed",
          100: "#ffead4",
          200: "#ffd0a8",
          300: "#ffad70",
          400: "#ff7f37",
          500: "#f45d10",
          600: "#d94406",
          700: "#b43209",
          800: "#8f2a10",
          900: "#742510",
        },
      },
      fontFamily: {
        display: ["Georgia", "Cambria", '"Times New Roman"', "serif"],
      },
      keyframes: {
        steam: {
          "0%": { opacity: "0.2", transform: "translateY(2px)" },
          "50%": { opacity: "1", transform: "translateY(-2px)" },
          "100%": { opacity: "0.2", transform: "translateY(2px)" },
        },
      },
      animation: { steam: "steam 1.2s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
