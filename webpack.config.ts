import * as webpack from "webpack";
import fs from "fs";
import readdirRecursive from "recursive-readdir";
import Handlebars from "handlebars";
import HtmlWebpackPlugin from "html-webpack-plugin";
import feather from "feather-icons";

const BUILD_DATA = {
  title: "Git 3D",
  alerts: [
    {
      level: "danger",
      icon: feather.icons["alert-octagon"].toSvg({ "aria-label": "Danger:" }),
      message: "Everything's broken!",
    },
    {
      level: "warning",
      icon: feather.icons["alert-triangle"].toSvg({ "aria-label": "Warning:" }),
      message: "Everything is probably broken",
    },
    {
      level: "info",
      icon: feather.icons["info"].toSvg(),
      message: "Everything should be fine",
    },
  ],
  navbar: {
    mainHeading: "Git 3D",
    settingsMenuBtnLbl: "Settings",
    settingsMenuBtnIcon: feather.icons.settings.toSvg(),
  },
  main: {},
  footer: {
    author: "Dan Vicarel",
  },
};

export default async () => {
  const partialsDir = "src/";
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
            minimize: true,
            preprocessor: handlebarsPreprocessor,
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
  const filenames = await readdirRecursive(partialsDir);
  const hbsFilenames = filenames.filter((x) => x.endsWith(handlebarsExtension));
  (await Promise.all(hbsFilenames.map((x) => fs.promises.readFile(x, "utf8"))))
    .map((partial, index) => {
      const path = hbsFilenames[index]
        .replace(partialsDir, "")
        .replace(handlebarsExtension, "");
      return {
        name: path.endsWith("/index")
          ? path.substring(0, path.length - 6)
          : path,
        partial: partial,
      };
    })
    .forEach((x) => Handlebars.registerPartial(x.name, x.partial));
}

function handlebarsPreprocessor(content: any, loaderContext: any): string {
  try {
    return Handlebars.compile(content)(BUILD_DATA);
  } catch (error) {
    loaderContext.emitError(error);
    return content;
  }
}
