
const fs = require('fs');

const hashedFilePattern = (prefix, suffix) => new RegExp(`${prefix}([^.]+)\.${suffix}`);

const bundleJsPattern = hashedFilePattern('bundle.', 'js');

const filteredFiles = (folder, pattern) => fs.readdirSync(folder).filter(f => pattern.test(f))

module.exports.getBundleJs = (folder) => filteredFiles(folder, bundleJsPattern)[0];

module.exports.getHashedFile = (folder, prefix, suffix) => filteredFiles(folder, hashedFilePattern(prefix, suffix))[0];

module.exports.getBundleJsHash = (folder) => filteredFiles(folder, bundleJsPattern).map(f => bundleJsPattern.exec(f)[1])[0];