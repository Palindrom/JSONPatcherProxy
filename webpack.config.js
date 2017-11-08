const webpack = require('webpack');
const MinifyPlugin = require('babel-minify-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const version = require('./package.json').version;

const banner = `JSONPatcherProxy version: ${version}`

module.exports = [
  {
    entry: './src/jsonpatcherproxy.js',
    output: {
      filename: 'dist/jsonpatcherproxy.min.js',
      library: 'JSONPatcherProxy',
      libraryTarget: 'var'
    },
    plugins: [
      new MinifyPlugin(),
      new webpack.BannerPlugin({
        banner
      })
    ],
    resolve: {
      extensions: ['.js']
    }
  },
  {
    entry: './src/jsonpatcherproxy.js',
    output: {
      filename: 'dist/jsonpatcherproxy.js',
      library: 'JSONPatcherProxy',
      libraryTarget: 'var'
    },
    plugins: [
      new webpack.BannerPlugin({
        banner
      })
    ],
    resolve: {
      extensions: ['.js']
    }
  }
];
