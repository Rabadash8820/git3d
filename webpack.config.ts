import * as webpack from "webpack";
import fs from "fs";
import Handlebars from "handlebars";
import HtmlWebpackPlugin from "html-webpack-plugin";

const BUILD_DATA = {
  title: "Git 3D",
  navbar: {
    mainHeading: "Git 3D",
  },
  main: {},
  footer: {
    author: "Dan Vicarel",
  },
};

export default async () => {

  const partialsDir = "./src";
  const hbsExt = ".hbs.html";
  await registerHandlebarsPartials(partialsDir, hbsExt);

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
            minimize:true,
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
  }

  return config;
};


async function registerHandlebarsPartials(partialsDir: string, handlebarsExtension: string): Promise<void> {
  const filenames = await fs.promises.readdir(partialsDir);
  const hbsFilenames = filenames.filter(x => x.endsWith(handlebarsExtension));
  (await Promise.all(
    hbsFilenames.map(x => fs.promises.readFile(`${partialsDir}/${x}`, "utf8"))
  ))
  .map((partial, index) => {
    const filename = hbsFilenames[index];
    return {
      name: filename.substring(0, filename.length - handlebarsExtension.length),
      partial: partial
    };
  })
  .forEach(x => Handlebars.registerPartial(x.name, x.partial));
}

function handlebarsPreprocessor(content: any, loaderContext: any): string {
  try {
    return Handlebars.compile(content)(BUILD_DATA);
  }
  catch (error) {
    loaderContext.emitError(error);
    return content;
  }
}
