const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "main.js",
  },
  devtool: "inline-source-map",
  plugins: [
    new HtmlWebpackPlugin({
      template: "index.html",
    }),
  ],
  resolve: {
    extensions: ["", ".ts", ".js"],
  },
  module: {
    rules: [
      { test: /\.html$/, loader: "html-loader" },
      { test: /\.ts$/, loader: "ts-loader" },
    ],
  },
  stats: {
    errorDetails: true,
  },
};
