import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#e7d6b0", // primary cream surface
        parch: "#f0e4c6", // lighter card surface
        ink: "#1c1712", // near-black warm ink
        ink2: "#3a2c20",
        oxblood: "#9a3325",
        oxbloodlit: "#b8402e",
        clay: "#c07a36",
        olive: "#5f6f3a", // village / seer accent
        bone: "#f5ecd6", // light text on ink
        ash: "#8c7f63", // muted on cream
        moon: "#dde4ff",
      },
      fontFamily: {
        stage: ['"Rakkas"', "serif"],
        title: ['"Aref Ruqaa"', "serif"],
        sans: ['"Tajawal"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        hard: "5px 5px 0 0 #1c1712",
        hardsm: "3px 3px 0 0 #1c1712",
        hardbone: "5px 5px 0 0 #f5ecd6",
      },
      keyframes: {
        floatUp: {
          "0%": { transform: "translateY(0) scale(0.9)", opacity: "0" },
          "12%": { opacity: "1" },
          "100%": { transform: "translateY(-240px) scale(1.7)", opacity: "0" },
        },
        twinkle: {
          "0%,100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        riseIn: {
          "0%": { transform: "translateY(14px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        floatUp: "floatUp 4.2s ease-out forwards",
        twinkle: "twinkle 4s ease-in-out infinite",
        riseIn: "riseIn 0.5s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
