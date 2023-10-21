
const fs = require('fs');

const hashedFilePattern = (prefix, suffix) => new RegExp(`${prefix}([^.]+)\.${suffix}`);

const vendorJsPattern = hashedFilePattern('vendor.', 'js');
const bundleJsPattern = hashedFilePattern('bundle.', 'js');

const filteredFiles = (folder, pattern) => fs.readdirSync(folder).filter(f => pattern.test(f))

module.exports.getVendorJs = (folder) => filteredFiles(folder, vendorJsPattern)[0];
module.exports.getBundleJs = (folder) => filteredFiles(folder, bundleJsPattern)[0];

module.exports.getHashedFile = (folder, prefix, suffix) => filteredFiles(folder, hashedFilePattern(prefix, suffix))[0];

module.exports.getVueSequenceBundleJsHash = (folder) => filteredFiles(folder, vueSequenceBundleJsPattern).map(f => vueSequenceBundleJsPattern.exec(f)[1])[0];
