/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#EF4444',
        'primary-dark': '#DC2626',
        'primary-glow': '#F87171',

        'accent-blue': '#3B82F6',
        'accent-blue-dark': '#1D4ED8',
        'accent-blue-glow': '#60A5FA',

        'accent-purple': '#A855F7',
        'flame-orange': '#F97316',

        'bg-dark': '#0C0B0E',
        'card-dark': '#16151B',
        'card-dark-border': '#2D2533',
        'surface-dark': '#211F2B',
        'surface-dark-border': '#383144',

        'bg-light': '#F9FAFB',
        'card-light': '#FFFFFF',
        'card-light-border': '#E5E7EB',
        'surface-light': '#F3F4F6',

        'text-primary-dark': '#FFFFFF',
        'text-secondary-dark': '#9CA3AF',
        'text-muted-dark': '#6B7280',

        'text-primary-light': '#111827',
        'text-secondary-light': '#4B5563',
        'text-muted-light': '#9CA3AF',
      },
    },
  },
  plugins: [],
};
