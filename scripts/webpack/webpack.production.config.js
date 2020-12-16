/**
 * Created by Yonatan on 29/11/2017.
 */
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const commonConfig = require("./webpack.common.config");
const vendorConfig = require("./webpack.vendors.config");
const appConfig = require("./webpack.app.config");

module.exports = function(){
    return {
        entry: Object.assign(vendorConfig.entry, appConfig.entry),
        output: appConfig.output,
        mode: "production",
        module: {
            rules: vendorConfig.module.rules.concat(appConfig.module.rules)
        },
        plugins: commonConfig.plugins.production.concat([
            new UglifyJsPlugin({
                parallel: true,
                sourceMap: true,
                uglifyOptions: {
                    ie8: false,
                    ecma: 8
                }
            })
        ]),
        resolve: commonConfig.resolve,
        stats: {
            colors: true,
            errorDetails: true
        }
    };
};