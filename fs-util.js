
const fs = require('fs');

const hashedFilePattern = (prefix, suffix) => new RegExp(`${prefix}([^.]+)\.${suffix}`);

const vueSequenceBundleJsPattern = hashedFilePattern('vue-sequence-bundle.', 'js');

const filteredFiles = (folder, pattern) => fs.readdirSync(folder).filter(f => pattern.test(f))

module.exports.getVueSequenceBundleJs = (folder) => filteredFiles(folder, vueSequenceBundleJsPattern)[0];

module.exports.getHashedFile = (folder, prefix, suffix) => filteredFiles(folder, hashedFilePattern(prefix, suffix))[0];

module.exports.getVueSequenceBundleJsHash = (folder) => filteredFiles(folder, vueSequenceBundleJsPattern).map(f => vueSequenceBundleJsPattern.exec(f)[1])[0];
