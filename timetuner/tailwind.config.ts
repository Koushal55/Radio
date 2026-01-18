import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                braun: {
                    bg: "#1a1a1a", // Dark background
                    black: "#111111", // Darker dial
                    orange: "#ff4400",
                    gray: "#888888",
                    text: "#e0e0e0", // Light text
                    chassis: "#2a2a2a", // Radio body color
                },
            },
            fontFamily: {
                sans: ["Inter", "Helvetica", "Arial", "sans-serif"],
            },
        },
    },
    plugins: [],
};
export default config;
