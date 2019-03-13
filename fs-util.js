
const fs = require('fs');

const bundleJsPattern = /bundle\.([^.]+)\.js/;

const filteredFiles = (folder) => fs.readdirSync(folder).filter(f => bundleJsPattern.test(f))

module.exports.getBundleJs = (folder) => filteredFiles(folder)[0];

module.exports.getBundleJsHash = (folder) => filteredFiles(folder).map(f => bundleJsPattern.exec(f)[1])[0];