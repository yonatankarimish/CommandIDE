module.exports = {
    //parser: 'sugarss',
    plugins: {
        'postcss-import': {}, //handles @import statements in css that import css files or node modules which have a css file as their main entry point
        'postcss-cssnext': {}, //transforms newly released css features to more compatible cross-browser syntax
        'cssnano': {} //optimizes css files to create smaller file sizes
    }
};