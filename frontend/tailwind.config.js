/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#162846",
          dark: "#0F1C32",
          light: "#1F355B",
          50: "#F0F4FA",
          100: "#DCE5F3",
          600: "#2B4C82",
          700: "#203A64",
          800: "#162846",
          900: "#0F1C32",
        },
        gold: {
          DEFAULT: "#D97706",
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#F59E0B",
          600: "#D97706",
          700: "#B45309",
        },
        teal: {
          DEFAULT: "#0D9488",
          50: "#F0FDFA",
          100: "#CCFBF1",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
        },
      },
    },
  },
  plugins: [],
};
