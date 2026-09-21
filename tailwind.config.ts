import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "hsl(215 24% 97%)",
          100: "hsl(215 20% 94%)",
          200: "hsl(215 16% 87%)",
          700: "hsl(215 25% 24%)",
          800: "hsl(215 30% 17%)",
          900: "hsl(215 34% 11%)"
        },
        emerald: {
          400: "hsl(164 54% 47%)",
          500: "hsl(164 55% 39%)",
          600: "hsl(165 58% 31%)"
        },
        accent: {
          400: "hsl(31 90% 65%)",
          500: "hsl(31 86% 56%)"
        }
      },
      boxShadow: {
        glass: "0 24px 80px hsl(215 35% 12% / 0.12)",
        soft: "0 12px 40px hsl(215 35% 12% / 0.08)"
      },
      backgroundImage: {
        "deba-radial": "radial-gradient(circle at 15% 10%, hsl(164 55% 39% / .18), transparent 30%), radial-gradient(circle at 85% 20%, hsl(31 86% 56% / .14), transparent 28%), linear-gradient(135deg, hsl(215 34% 11%), hsl(215 28% 17%) 55%, hsl(164 36% 19%))"
      }
    }
  },
  plugins: []
};

export default config;
