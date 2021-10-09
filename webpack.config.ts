import * as webpack from "webpack";
import fs from "fs";
import readdirRecursive from "recursive-readdir";
import Handlebars from "handlebars";
import HtmlWebpackPlugin from "html-webpack-plugin";
import ViewDataBuilder from "./build/ViewDataBuilder";

export default async () => {
  const hbsExt = ".hbs.html";
  await registerHandlebarsPartials("src/", hbsExt);

  const viewData = await new ViewDataBuilder().BuildViewData();

  const config: webpack.Configuration = {
    entry: "./src/index.ts",
    output: {
      filename: "main.js",
    },
    devtool: "inline-source-map",
    plugins: [new HtmlWebpackPlugin({ template: `index${hbsExt}` })],
    resolve: { extensions: ["", ".ts", ".js"] },
    module: {
      rules: [
        {
          test: new RegExp(`\.${hbsExt}$`),
          loader: "html-loader",
          options: {
            minimize: true,
            preprocessor: (content: any, loaderContext: any) =>
              handlebarsPreprocessor(content, loaderContext, viewData),
          },
        },
        { test: /\.ts$/, loader: "ts-loader" },
        {
          test: /\.s?css$/,
          use: ["style-loader", "css-loader", "postcss-loader", "sass-loader"],
        },
      ],
    },
    stats: { errorDetails: true },
    devServer: {
      contentBase: "dist",
      https: true,
      open: true,
    },
  };

  return config;
};

async function registerHandlebarsPartials(
  partialsDir: string,
  handlebarsExtension: string
): Promise<void> {
  const indexTemplateName: string = "/index";
  const filenames = await readdirRecursive(partialsDir);
  const hbsFilenames = filenames.filter((x) => x.endsWith(handlebarsExtension));
  (await Promise.all(hbsFilenames.map((x) => fs.promises.readFile(x, "utf8"))))
    .map((partial, index) => {
      const path = hbsFilenames[index]
        .replace(partialsDir, "")
        .replace(handlebarsExtension, "");
      return {
        name: path.endsWith(indexTemplateName)
          ? path.substring(0, path.length - indexTemplateName.length)
          : path,
        partial: partial,
      };
    })
    .forEach((x) => Handlebars.registerPartial(x.name, x.partial));
}

function handlebarsPreprocessor(
  content: any,
  loaderContext: any,
  viewData: unknown
): string {
  try {
    return Handlebars.compile(content)(viewData);
  } catch (error) {
    loaderContext.emitError(error);
    return content;
  }
}
