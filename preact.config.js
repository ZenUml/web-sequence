const webpack = require('webpack');
const {GitRevisionPlugin} = require('git-revision-webpack-plugin')
import tailwindcss from 'tailwindcss';
import postcssCustomMedia from 'postcss-custom-media';
import optionalChaining from '@babel/plugin-proposal-optional-chaining'
import nullishOperator from '@babel/plugin-proposal-nullish-coalescing-operator'
/**
 * Function that mutates original webpack config.
 * Supports asynchronous changes when promise is returned.
 *
 * @param {object} config - original webpack config.
 * @param {object} env - options passed to CLI.
 * @param {WebpackConfigHelpers} helpers - object with useful helpers when working with config.
 **/
export default function(config, env, helpers) {
	const htmlWebpackPlugin = helpers.getPluginsByName(
		config,
		'HtmlWebpackPlugin'
	)[0];
	Object.assign(htmlWebpackPlugin.plugin.options.minify, {
		removeComments: false,
		collapseWhitespace: false
	});
	htmlWebpackPlugin.plugin.options.preload = false;
	htmlWebpackPlugin.plugin.options.favicon = false;

	if (env.isProd) {
		config.devtool = false; // disable sourcemaps
		config.output.publicPath = './';
		// config.plugins.push(
		// 	new CommonsChunkPlugin({
		// 		name: 'vendor',
		// 		minChunks: ({ resource }) => /node_modules/.test(resource)
		// 	})
		// );

	}
	const babelLoader = helpers.getLoadersByName(config, 'babel-loader')
	for (const result of babelLoader) {
		console.log(result.loader.options)
		result.loader.options.plugins.push(optionalChaining)
		result.loader.options.plugins.push(nullishOperator)
	}
	const results = helpers.getLoadersByName(config, 'postcss-loader');
	for (const result of results) {
		result.loader.options.postcssOptions.plugins = [
			postcssCustomMedia,
			tailwindcss('./tailwind.config.js'),
			...result.loader.options.postcssOptions.plugins
		];
	}

	const gitRevisionPlugin = new GitRevisionPlugin({commithashCommand: 'rev-parse --short HEAD'});
	config.plugins.push(new webpack.DefinePlugin({__COMMITHASH__: JSON.stringify(gitRevisionPlugin.commithash())}));
}
