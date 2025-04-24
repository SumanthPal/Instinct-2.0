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
          'dark-base': '#0F0E11',
          'dark-text': '#DAD4E3',
          'dark-gradient-start': '#463B55',
          'dark-gradient-end': '#8574A3',
          'dark-card': '#2A2333',
          'dark-profile-card': '#3C3344',
          'dark-text-white': '#F0EDF6',
          'dark-subtext': '#BBAFD1'
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
  