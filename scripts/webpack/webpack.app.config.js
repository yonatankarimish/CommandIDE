/**
 * Created by Yonatan on 05/11/2017.
 */
const path = require('path');

const commonConfig = require("./webpack.common.config");
const bbProperties = require('./webpack.properties');
const appRoot = path.join(__dirname, "/../../..");

module.exports = {
    entry: {
        polyfill: "@babel/polyfill", //Allows for using all our future coding hocus-pocus (generators, async await etc...)
        app: appRoot + bbProperties.app.entryScript,
        login: appRoot + bbProperties.login.entryScript
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
                test: /\.js$/,
                loader: 'babel-loader', //Transform es6 code and above into browser compatible es5 code
                include: path.join(appRoot, bbProperties.angularRoot),
                options: {
                    presets: [
                        ['@babel/preset-env', {
                            targets: {
                                browsers: ["last 2 versions", "ie >= 9"]
                            }
                        }]
                    ],
                    plugins: [
                        '@babel/plugin-proposal-class-properties'
                    ]
                }
            },
            {
                test: /\.css$/,
                include: commonConfig.sources.app,
                use: commonConfig.loaders.css
            },
            {
                test: /\.(png|jpg|jpeg|gif)$/,
                include: commonConfig.sources.app,
                use: commonConfig.loaders.image
            },
            {
                test: /\.(ttf|eot|woff|woff2|svg)($|\?.*$)/,
                include: commonConfig.sources.app,
                use: commonConfig.loaders.font
            }
        ]
    },
    plugins: commonConfig.plugins.app,
    resolve: commonConfig.resolve,
    stats: {
        colors: true,
        errorDetails: true
    },
    devtool: 'source-map'
};