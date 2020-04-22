const path = require('path')

module.exports = {
	entry: path.join(__dirname, 'main.js'),
	output: {
		path: path.join(__dirname, 'src/lib'),
		filename: 'vue-sequence-bundle.[chunkhash].js'
	},
	resolve: {
		alias: {
			vue: 'vue/dist/vue.esm.js'
		}
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.svg/,
				use: ['svg-url-loader']
			}
		]
	}
}
