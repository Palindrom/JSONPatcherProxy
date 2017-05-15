var webpack = require("webpack");

module.exports = [
  {
    entry: "./src/jsonpatcherproxy.js",
    output: {
      filename: "dist/jsonpatcherproxy.min.js",
      library: "JSONPatcherProxy",
      libraryTarget: "var"
    },
    resolve: {
      extensions: [".js"]
    }
  }
];
