/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0f16',
        'dark-surface': '#131b26',
        'dark-border': '#1e293b',
        'accent-cyan': '#87ceeb',
        'accent-yellow': '#FFF096',
        'accent-green': '#00e054',
      },
    },
  },
  plugins: [],
}
