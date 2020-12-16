/**
 * Created by Yonatan on 06/11/2017.
 */
const jsRegex =  /\.js$/;
const cssRegex = /\.css$/;
const newLine = "\r\n";
const angularRoot = "angular-app";
const appRoot = __dirname + "/../../../";
const vendorsFile = __dirname + "/../../" + angularRoot + "/vendors.js";
const indexFile = __dirname + "/../../" + angularRoot + "/index.js";

const fs = require('fs');
const path = require('path');
const walk = require('walk');
const Promise = require('promise');
const packageJson = require(appRoot+"package.json");
const bbProperties = require("./webpack.properties");

build();
function build(){
    console.log('Started building require graph');

    clearIndexFile()
        .then(importLibStyles) //TODO: find better way to automatically perform this task
        .then(importStyles)
        .then(importLibs)
        .then(importScripts)
        .then(() => console.log("Finished building require graph"))
        .catch((error) => console.log("Error in building require graph: exception was ", error));
}

function clearIndexFile(){
    return new Promise((resolve, reject) => {
        fs.unlink(vendorsFile, (err) => {/*intentionally empty*/});
        fs.unlink(indexFile, (err) => {/*intentionally empty*/});
        console.log('Cleared index file and vendor file');
        resolve();
    });
}

function importLibs(){
    return new Promise((resolve, reject) => {
        let importLibs = [];
        let excludesScripts = bbProperties.vendorFiles.injectFirst
            .concat(bbProperties.vendorFiles.injectLast)
            .concat(bbProperties.vendorFiles.ignore);

        for(let folder in packageJson.dependencies){
            if(excludesScripts.indexOf(folder) == -1) {
                importLibs.push(createImportStatement(folder));
            }
        }

        let injectFirstModules =  bbProperties.vendorFiles.injectFirst.map(path => createImportStatement(path));
        let injectLastModules =  bbProperties.vendorFiles.injectLast.map(path => createImportStatement(path));
        fs.appendFile(vendorsFile, injectFirstModules.concat(importLibs).concat(injectLastModules).join(''), (err) => {
            if (err) {
                reject(err);
            }
        });
        resolve();
    });
}

function importScripts(){
    return new Promise((resolve, reject) => {
        let bbJsWalker = walk.walk(__dirname+"/../../"+angularRoot, {followLinks: false});
        let importScripts = [];
        let excludesScripts = bbProperties.appFiles.injectFirst
            .concat(bbProperties.appFiles.injectLast)
            .concat(bbProperties.appFiles.ignore);

        bbJsWalker.on("file", (root, fileStat, next) => {
            try{
                if(!!fileStat.name.match(jsRegex)){
                    let requirePath = correctJsPath(root+"/"+fileStat.name, angularRoot);
                    if(excludesScripts.indexOf(requirePath) == -1) {
                        let requireStmt = createImportStatement(requirePath);
                        importScripts.push(requireStmt);
                    }
                }
            }finally{
                next();
            }
        });

        bbJsWalker.on("errors", (root, nodeStatsArray, next) => {
            nodeStatsArray.forEach((n) => {
                console.error("[ERROR] " + n.name);
                console.error(n.error.message || (n.error.code + ": " + n.error.path));
            });
            next();
        });

        bbJsWalker.on("end", () => {
            let injectFirstJs =  bbProperties.appFiles.injectFirst.map(path => createImportStatement(path));
            let injectLastJs =  bbProperties.appFiles.injectLast.map(path => createImportStatement(path));
            fs.appendFile(indexFile, injectFirstJs.concat(importScripts).concat(injectLastJs).join(''), (err) =>{
                if (err) {
                    reject(err);
                }
            });
            resolve();
        });
    });
}

function importLibStyles(){
    //Very ugly workaround to import styles from node_modules manually
    //A better solution must be used in this step, to automatically scan node_modules for library styles
    return new Promise((resolve, reject) => {
        let importStyles = ["angular-gridster/dist/angular-gridster.css",
                "angular-material/angular-material.css",
                "angular-ui-grid/ui-grid.min.css",
                "angular-ui-switch/angular-ui-switch.css",
                "angular-ui-tree/dist/angular-ui-tree.min.css",
                "angular-wizard/dist/angular-wizard.min.css",
                "lf-ng-md-file-input/dist/lf-ng-md-file-input.css",
                "ng-sortable/dist/ng-sortable.css",
                "chosen-js/chosen.css"];

        fs.appendFile(vendorsFile,importStyles.map(path => createImportStatement(path)).join(''), (err) => {
            if (err) {
                reject(err);
            }
        });
        resolve();
    });
}

function importStyles(){
    return new Promise((resolve, reject) => {
        let bbCssWalker = walk.walk(__dirname + "/../../assets/css", {followLinks: false});
        let importStyles = [];
        let excludesStyles = bbProperties.css.injectFirst
            .concat(bbProperties.css.injectLast)
            .concat(bbProperties.css.ignore);

        bbCssWalker.on("file", (root, fileStat, next) => {
            try{
                if(!!fileStat.name.match(cssRegex)){
                    let requirePath = correctCssPath(root+"/"+fileStat.name);
                    if(excludesStyles.indexOf(requirePath) == -1){
                        let requireStmt = createImportStatement(requirePath);
                        importStyles.push(requireStmt);
                    }
                }
            }finally{
                next();
            }
        });

        bbCssWalker.on("errors", (root, nodeStatsArray, next) =>{
            nodeStatsArray.forEach((n) => {
                console.error("[ERROR] " + n.name);
                console.error(n.error.message || (n.error.code + ": " + n.error.path));
            });
            next();
        });

        bbCssWalker.on("end", () => {
            let injectFirstCss =  bbProperties.css.injectFirst.map(path => createImportStatement(path));
            let injectLastCss =  bbProperties.css.injectLast.map(path => createImportStatement(path));
            fs.appendFile(indexFile,injectFirstCss.concat(importStyles).concat(injectLastCss).join(''), (err) => {
                if (err) {
                    reject(err);
                }
            });
            resolve();
        });
    });
}


function correctJsPath(path){
    return "."+path.replace(/\\/g, "/").split(angularRoot)[1];
}

function correctCssPath(path){
    return path.replace(/\\/g, "/").split('scripts/webpack/../')[1];
}


function createImportStatement(file){
    return "import '"+file+"';"+newLine
}