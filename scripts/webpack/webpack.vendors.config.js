/**
 * Created by Yonatan on 05/11/2017.
 */
const path = require('path');
const webpack = require('webpack');

const commonConfig = require("./webpack.common.config");
const bbProperties = require('./webpack.properties');
const appRoot = __dirname + "/../../..";

module.exports = {
    entry: {
        vendors: appRoot + bbProperties.vendors.entryScript
    },
    output: {
        path: appRoot +  bbProperties.distFolder,
        publicPath: "dist",
        filename: "js/[name].bundle.js"
    },
    mode: "development",
    module: {
        rules: [
            {
                test: /\.css$/,
                include: commonConfig.sources.vendor,
                use: commonConfig.loaders.css
            },
            {
                test: /\.(png|jpg|jpeg|gif)$/,
                include: commonConfig.sources.vendor,
                use: commonConfig.loaders.image
            },
            {
                test: /\.(ttf|eot|woff|woff2|svg)($|\?.*$)/,
                include: commonConfig.sources.vendor,
                use: commonConfig.loaders.font
            }
        ]
    },
    plugins: commonConfig.plugins.vendor,
    resolve: commonConfig.resolve,
    stats: {
        colors: true,
        errorDetails: true
    },
    devtool: 'source-map'
};