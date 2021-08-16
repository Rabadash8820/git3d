import * as webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";

const config: webpack.Configuration = {
  entry: "./src/index.ts",
  output: { filename: "main.js" },
  devtool: "inline-source-map",
  plugins: [new HtmlWebpackPlugin({ template: "index.html" })],
  resolve: { extensions: ["", ".ts", ".js"] },
  module: {
    rules: [
      { test: /\.html$/, loader: "html-loader" },
      { test: /\.ts$/, loader: "ts-loader" },
    ],
  },
  stats: { errorDetails: true },
  devServer:{
    contentBase: "dist",
    https: true,
    open: true,
  }
};

export default config;
