 Error: Couldn't find preset "preact-cli/babel" relative to directory 
 "/Users/pengxiao/workspaces/zenuml/vue-sequence/dist"

This is happening when we use linked node module locally.

babel is expecting a .babelrc file in the above folder. Otherwise, we need
a project level babel.config.js. I renamed the .babelrc file to babel.config.js
it is fixed.
