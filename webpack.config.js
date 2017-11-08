const webpack = require('webpack');
const MinifyPlugin = require('babel-minify-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

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
      // src file can be used in production everywhere
      new CopyWebpackPlugin([
        { from: './src/jsonpatcherproxy.js', to: './dist/jsonpatcherproxy.js' }
      ])
    ],
    resolve: {
      extensions: ['.js']
    }
  }
];
