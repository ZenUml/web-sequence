const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
	entry: path.join(__dirname, 'main.js'),
	plugins: [
		new CleanWebpackPlugin({
			cleanOnceBeforeBuildPatterns: ['vue-sequence-bundle.*.js']
		})
	],
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
			}
		]
	}
}
