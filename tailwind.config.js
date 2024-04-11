/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
		"./src/**/*.{js,jsx,ts,tsx}"
	],
  theme: {
    extend: {
			keyframes: {
				overlayShow: {
					from: { opacity: '0' },
					to: { opacity: '1' },
				},
				contentShow: {
					from: { opacity: '0', transform: 'translate(-50%, -40%) scale(0.9)' },
					to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
				},
			},
			animation: {
				overlayShow: 'overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
				contentShow: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
			},
			colors: {
				gray: {
					100: '#f5f5f5',
					200: '#ebebeb',
					300: '#d2d2d2',
					400: '#c2c2c2',
					500: '#A5A5A5',
					600: '#5A5A5A',
					700: '#454856',
				},
				primary: {
					100: '#E2E5E9',
					400: '#8ab2ff',
					DEFAULT: '#6786f7',
				},
				neutral: {
					400: '#98a2b3'
				},
				black: {
					400: '#2c2d31',
					500: '#202020',
					600: '#3e3e42',
					700: '#323232',
					800: '#1e1e1e',
					DEFAULT: '#000000'
				}
			}
		},
  },
  plugins: [],
}

