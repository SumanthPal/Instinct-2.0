/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
      "./app/**/*.{js,ts,jsx,tsx,mdx}",
      "./pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./components/**/*.{js,ts,jsx,tsx,mdx}",
      "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
      extend: {
        borderRadius: {
          lg: 'var(--radius)',
          md: 'calc(var(--radius) - 2px)',
          sm: 'calc(var(--radius) - 4px)',
        },
        colors: {
          background: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
          card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))',
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))',
          },
          primary: {
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))',
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            foreground: 'hsl(var(--secondary-foreground))',
          },
          'pastel-pink': '#F8C8D8',
          'lavender': '#E6D0FF',
          'sky-blue': '#A7D8FF',
          'white': '#FFFFFF',
          'dark-base': '#131212',
          'dark-text': '#2F2C36',
          'dark-gradient-start': '#4D4855',
          'dark-gradient-end': '#A399B2',
          'dark-card': '#F2E6FF',
          'dark-profile-card': '#3D2F4E',
          'dark-text-white': '#F8F9FA',
          'dark-subtext': '#EDE8F2'
        },
        keyframes: {
          gradientShift: {
            '0%': { backgroundPosition: '0% 50%' },
            '50%': { backgroundPosition: '100% 50%' },
            '100%': { backgroundPosition: '0% 50%' },
          },
        },
        animation: {
          gradientShift: 'gradientShift 5s ease infinite',
        },
      },
    },
    plugins: [],
  };
  