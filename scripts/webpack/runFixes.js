/**
 * Created by Yonatan on 26/11/2017.
 */
const fs = require('fs');
const path = require('path');
const Promise = require('promise');
const appRoot = __dirname + "/../../../";

var Fix = function (path, find, replace) {
    this.restore = function () {
        return fixFile(path, replace, find);
    }
    this.fix = function () {
        return fixFile(path, find, replace);
    }

    function fixFile(filepath, find, replacement) {
        return new Promise((resolve, reject) => {
            fs.readFile(filepath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                }
                let result = data.replace(find, replacement);
                fs.writeFile(filepath, result, 'utf8', (err) => {
                    err ? reject(err) : resolve();
                });
            });
        });
    }
}

run();

function run() {
    //paths
    const angular_material = path.join(appRoot, "node_modules/angular-material/angular-material.js");
    const lfNgMdFileInput = path.join(appRoot, "node_modules/lf-ng-md-file-input/dist/lf-ng-md-file-input.js");
    const ui_grid = path.join(appRoot, "node_modules/angular-ui-grid/ui-grid.js");
    const ui_grid_draggable_rows = path.join(appRoot, "node_modules/ui-grid-draggable-rows/js/draggable-rows.js");

    //fixes
    const materialSideSheetFix = new Fix(angular_material, '$mdBottomSheet.destroy();', '//$mdBottomSheet.destroy();');
    const lfNgMdFileInputFix = new Fix(lfNgMdFileInput, '<input type="file"', '<input type="file" title="   "');
    const uiGridDraggableRowsFix = new Fix(ui_grid_draggable_rows, "grid.api.draggableRows.raise.beforeRowMove(from, to, this);", "if (from > to) { to = to - 1;} else if (to == from)  { to = from -1;} grid.api.draggableRows.raise.beforeRowMove(from, to, this);")
    // ui-grid fixes:
    const ui_grid_flickering_original = {
        header: 'container.explicitHeaderHeight = null;',
        canvas: 'container.explicitHeaderCanvasHeight = null;'
    };
    const ui_grid_flickering_fix = {
        header: 'if(!container.explicitHeaderHeight){container.explicitHeaderHeight = null;}',
        canvas: 'if(!container.explicitHeaderCanvasHeight){container.explicitHeaderCanvasHeight = null;}'
    };
    const uiGridFlickeringRowsFixArr = [new Fix(ui_grid, ui_grid_flickering_original.header, ui_grid_flickering_fix.header), new Fix(ui_grid, ui_grid_flickering_original.canvas, ui_grid_flickering_fix.canvas)];
    const uiGridHamburgerFixFind = "$scope.$emit('menu-hidden');\n" +
        "            }\n" +
        "          }, 200);";
    const uiGridHamburgerFixReplace = "$scope.$emit('menu-hidden');\n" +
        "            }\n" +
        "          }, 1000);";
    const uiGridHamburgerFix = new Fix(ui_grid, uiGridHamburgerFixFind, uiGridHamburgerFixReplace);
    const uiGridFixes = [...uiGridFlickeringRowsFixArr, uiGridHamburgerFix];

    function restoreUIGrid() { // will run fixes in serial
        return uiGridFixes.reduce((p, fix) => {
            return p.then(() => fix.restore())
        }, Promise.resolve());
    }
    function fixUIGrid() { // will run fixes in serial
        return uiGridFixes.reduce((p, fix) => {
            return p.then(() => fix.fix())
        }, Promise.resolve());
    }



    // restore vendors scripts and then fix them
    // make sure that multiple fixes for the same path will run in serial
    Promise.all([
        materialSideSheetFix.restore(),
        lfNgMdFileInputFix.restore(),
        restoreUIGrid(),
        uiGridDraggableRowsFix.restore()
    ]).then(() => {
        Promise.all([
            materialSideSheetFix.fix(),
            lfNgMdFileInputFix.fix(),
            fixUIGrid(),
            uiGridDraggableRowsFix.fix()
        ])
    }).catch((error) => console.log("Error encountered while running fixes on library scripts: exception was ", error));

}

