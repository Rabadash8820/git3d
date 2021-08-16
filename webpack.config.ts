import * as webpack from "webpack";
import Handlebars from "handlebars";
import HtmlWebpackPlugin from "html-webpack-plugin";

const BUILD_DATA = {
  author: "Dan Vicarel",
  projectName: "Git 3D",
};

const config: webpack.Configuration = {
  entry: "./src/index.ts",
  output: {
    filename: "main.js",
  },
  devtool: "inline-source-map",
  plugins: [new HtmlWebpackPlugin({ template: "index.hbs.html" })],
  resolve: { extensions: ["", ".ts", ".js"] },
  module: {
    rules: [
      {
        test: /\.hbs.html$/,
        loader: "html-loader",
        options: {
          preprocessor: handlebarsPreprocessor,
        }
      },
      { test: /\.ts$/, loader: "ts-loader" },
      {
        test: /\.(scss|css)$/,
        use: [
          "style-loader",
          "css-loader",
          "postcss-loader",
          "sass-loader"
        ]
      }
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


function handlebarsPreprocessor(content: any, loaderContext: any): string {
  try {
    return Handlebars.compile(content)(BUILD_DATA);
  }
  catch (error) {
    loaderContext.emitError(error);
    return content;
  }
}
