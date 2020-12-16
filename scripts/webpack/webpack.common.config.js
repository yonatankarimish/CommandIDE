/**
 * Created by Yonatan on 30/11/2017.
 */
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const bbProperties = require('./webpack.properties');
const appRoot = path.join(__dirname, "/../../..");

let plugins = {
    //Scans all source files and displays their sizes as a TreeMap chart. Disabled by default
    analyzePlugin: new BundleAnalyzerPlugin({
        analyzerMode: 'static'
    }),

    //Exposes certain libraries using global variables, without the need to manually require them in every file
    //Takes the format {global_var_name: node_module_name}
    providePlugin: new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery",
        "window.jQuery": "jquery",
        moment: "moment",
        qrcode: "qrcode-generator",
        ipaddr: "ipaddr.js"
    }),

    //Creates an html file with vendor bundle injected as <script> tags
    vendorFilePlugin: new HtmlWebpackPlugin({
        chunks: ['vendors'],
        filename: '../angular-app/menu/' + bbProperties.vendors.outputFile,
        hash: "true", //cache busting
        template: appRoot + bbProperties.vendors.location + "/" + bbProperties.vendors.inputFile
    }),

    //Creates an html file with app bundle injected as <script> tags
    appFilePlugin: new HtmlWebpackPlugin({
        chunks: ['app'],
        filename: '../angular-app/menu/' + bbProperties.app.outputFile,
        hash: "true", //cache busting
        template: appRoot + bbProperties.app.location + "/" + bbProperties.app.inputFile
    }),

    //Joint html file for production build: all chunks built simultaneously
    distFilePlugin: new HtmlWebpackPlugin({
        chunks: ['vendors', 'app'],
        chunksSortMode: 'manual',
        filename: '../angular-app/menu/' + bbProperties.app.outputFile,
        hash: "true", //cache busting
        template: appRoot + bbProperties.vendors.location + "/" + bbProperties.vendors.inputFile
    }),

    //Creates an html file for login page
    loginFilePlugin: new HtmlWebpackPlugin({
        chunks: ['login'],
        filename: '../'+bbProperties.login.outputFile,
        hash: "true", //cache busting
        template: appRoot + bbProperties.login.location + "/" + bbProperties.login.inputFile
    })
};

let resolveConfig = {
    //extensions: ["",".js", ".json"],
    alias: {
        ["~"]: path.join(appRoot, "/")
    }
};

module.exports = {
    sources: {
        vendor: [
            path.join(appRoot, "node_modules")
        ],
        app: [
            path.join(appRoot, bbProperties.assetsFolder),
            path.join(appRoot, bbProperties.webContent, "/libs")
        ]
    },
    loaders: {
        css: [
            {loader: 'style-loader'}, //Extends import statements so they can support css files. They are later injected as <style> tags into the DOM
            {loader: 'css-loader', query: {importLoaders: 1}}, //Handles inline @import statements in css files
            //{loader: 'postcss-loader', query: {config: {path: __dirname+'/postcss.config.js'}}} //Performs additional transforms on the resulting css files. Currently disabled as some of our libraries are not compatible with it
        ],
        image: [{
            loader: 'file-loader', //Handles inline url() statements for images and copies therm to our /dist folder
            options: {
                name:'[name].[hash].[ext]',
                outputPath:"/assets/images/"
            }
        }],
        font: [{
            loader: 'file-loader', //Handles inline url() statements for fonts and copies therm to our /dist folder
            options: {
                name:'[name].[hash].[ext]',
                outputPath:"/assets/fonts/"
            }
        }]
    },
    plugins: {
        vendor: [plugins.providePlugin, plugins.vendorFilePlugin],
        app: [/*plugins.analyzePlugin,*/ plugins.providePlugin, plugins.appFilePlugin, plugins.loginFilePlugin],
        production: [plugins.providePlugin, plugins.distFilePlugin, plugins.loginFilePlugin],
    },
    resolve: resolveConfig
};