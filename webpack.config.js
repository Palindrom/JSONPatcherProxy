const webpack = require('webpack');
const version = require('./package.json').version;
const banner = `JSONPatcherProxy version: ${version}`

module.exports = [
  {
    entry: './src/jsonpatcherproxy.js',
    output: {
      filename: 'jsonpatcherproxy.js',
      libraryExport: 'default',
      library: 'JSONPatcherProxy',
      libraryTarget: 'var'
    },
    mode: 'production',
    optimization: {
      minimize: false
    },
    resolve: {
      extensions: ['.js']
    },
    plugins: [new webpack.BannerPlugin(banner)]
  },
  {
    entry: './src/jsonpatcherproxy.js',
    output: {
      filename: 'jsonpatcherproxy.min.js',
      libraryExport: 'default',
      library: 'JSONPatcherProxy',
      libraryTarget: 'var'
    },
    mode: 'production',
    resolve: {
      extensions: ['.js']
    },
    plugins: [new webpack.BannerPlugin(banner)]
  }
];
