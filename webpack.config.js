const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const publicPath = "/";

  return {
    entry: "./src/main.ts",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].[contenthash].js",
      clean: true,
      publicPath: publicPath,
    },

    module: {
      rules: [
        {
          test: /\.json$/,
          type: "asset/source",
        },
        {
          test: /\.ts$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
        {
          test: /\.md$/,
          type: "asset/source",
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
    devServer: {
      static: {
        directory: path.join(__dirname, "dist"),
      },
      historyApiFallback: true,
      hot: true,
      port: 3000,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "index.html",
      }),
      new MiniCssExtractPlugin({
        filename: "[name].[contenthash].css",
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: "src/data", to: "data" }, { from: "public" }],
      }),
    ],
  };
};
