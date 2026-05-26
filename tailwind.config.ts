import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        target: "#cc0000",
        walmart: "#0071dc",
        homedepot: "#f96302",
        lowes: "#004990",
      },
    },
  },
  plugins: [],
};
export default config;
