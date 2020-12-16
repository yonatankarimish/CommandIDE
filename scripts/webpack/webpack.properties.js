/**
 * Created by Yonatan on 05/11/2017.
 */
let webContent = "/WebContent";
let angularRoot = webContent + "/angular-app";
let appLocation = webContent + "/angular-app/menu";
let distFolder = webContent + "/dist";
let loginFolder = appLocation + "/login";

module.exports = {
    root: "./", // reference location for the assets
    assetsFolder: webContent + "/assets", // reference location for the assets
    angularRoot: angularRoot, // reference location for anything angular
    distFolder: distFolder, // location of resulting files at the end of the build process
    webContent: webContent,  // default location of all client side files
    nodeFolder: "./node_modules",

    vendors:{
        location: appLocation,  // location of the main application files
        entryScript: angularRoot + "/vendors.js", //location of the entry script for backbox vendor scripts
        outputScript: "js/vendors.bundle.js", //vendor bundle to output to dist folder at the end of the build process
        inputFile: "appDev.html",  // initial, the one devs work on
        outputFile: "appTemp.html",  // interim, after vendor bundling
    },
    app:{
        location: appLocation,  // location of the main application files
        entryScript: angularRoot + "/index.js", //location of the entry script for backbox main app
        outputScript: "js/app.bundle.js", //main file name to output to dist folder at the end of the build process
        inputFile: "appTemp.html",  //  interim, after vendor bundling
        outputFile: "app.html",  // final, runs on the machine
    },
    login:{
        location: loginFolder, // location of login files
        entryScript: loginFolder + "/login.controller.js", //location of the entry script for backbox login page
        outputScript: "js/login.bundle.js", //login script name to output to dist folder at the end of the build process
        inputFile: "indexDev.html",  // initial, the one devs work on
        outputFile: "index.html",  // final, runs on the machine
    },

    //file path are relative to the application root
    filePaths: {
        dbUpdates: "/../sql/db-updates.sql", //contains all changes to the backboxV3 database schema since its initial creation
        foreignKeys: "/../sql/foreign-keys.sql", //contains all changes to the backboxV3 foreign keys since its initial creation
        securityJAR: "/../backbox-server-security/target/backbox-server-security-3.0.2.jar", //the compiled JAR file of the backbox-server-security module
        sftpConfig: "c:/backbox/config/sftp.config",  // location of default sftp configuration - must be present there and have the dev machine credentials there
        war: "/target/ROOT.war" // location of the war file
    },


    vendorFiles: {
        injectFirst: ["jquery"],
        injectLast: ["jquery-ui/ui/widgets/draggable",
            "jquery-ui/ui/widgets/resizable",
            "../libs/bootstrap/ui-bootstrap-tpls-2.5.0.js",
            "../libs/bootstrap/ui-bootstrap-tpls-0.11.0-inheritance.js",
            "../libs/angular-dialgauge/src/angular-dialgauge.js",
            //"../libs/guacamole-common-js/all.js", //Manually imported in terminal files
            "../libs/ui.bootstrap.contextMenu/contextMenu.js", //imported by yarn, should be removable
            //"../libs/vis/dist/vis.js", //Manually imported in angular-vis.js
            "../libs/angular-visjs/angular-vis.js",
            "../libs/trumbowyg/trumbowyg.js",
            "../libs/trumbowyg/plugins/base64/trumbowyg.base64.js",
            "../libs/trumbowyg/plugins/upload/trumbowyg.upload.js",
            "../libs/trumbowyg/plugins/colors/trumbowyg.colors.js",
            "../libs/angular-material-time-picker/dist/md-time-picker.js",
            "../libs/date/date.js"],
        ignore: []
    },

    appFiles: {
        injectFirst: [],
        injectLast: [],
        ignore: ["index.js",
            "./menu/login/login.controller.js",
            "./vendors.js"]
    },

    //file path are relative to the main entry file (./WebContent/angular-app/index.js)
    css: {
        //Stylesheets to inject before all collected styles in our loading order
        injectFirst: ["../assets/css/bootstrap.min.css",
            "../assets/css/dark-hive/jquery-ui-1.8.18.custom.css",
            "../libs/angular-material-time-picker/dist/md-time-picker.css",
            "../libs/vis/dist/vis.css"],
        //Stylesheets to inject after all collected styles in our loading order
        injectLast: ["../assets/css/angular-tree-control/css/tree-control-attribute.css",
            "../assets/css/angular-tree-control/css/tree-control.css",
            "../libs/trumbowyg/ui/trumbowyg.css",
            "../libs/trumbowyg/plugins/colors/ui/trumbowyg.colors.css",
            "../assets/css/overrides.css"],
        //Stylesheets that should not be injected into our main bundle
        ignore: ["../assets/css/login.css",
            "../assets/css/fonts/icomoon/demo-files/demo.css"]
    }
};