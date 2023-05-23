/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./**/*.{html,js,pug}'],
	plugins: [require("daisyui")],
	daisyui: {
		themes: ["dark"]
	},
	theme: {
		container: {
			center: true,
		}
	}
  }