## How to contribute to ZenUML

ZenUML is written in Preact (JavaScript), CSS & HTML. It uses few open-source 3rd party JavaScript libraries for things like splitting panes, syntax highlighting etc.

### Run ZenUML (web app) locally on your machine

- Clone the repo `git clone git@github.com:chinchang/web-maker.git`.
- Inside the repo, run `pnpm install` to install the dependencies.
- Run `pnpm run dev`

### Run ZenUML (Chrome extension) locally on your machine

- Follow all steps as listed above to run the web app.
- Instead of `pnpm run dev`, run `pnpm run build`. This will take some time.
- Now go to Chrome extension settings page [chrome://extensions/](chrome://extensions/).
- Click on **Load unpacked extension** button.
- Select the `extension/` folder in the repo.
- Done! You'll now have a ZenUML icon added in your browser's right-top area. Click that and you'll run your local copy of ZenUML.

### Code changes

- Before starting any code work, run `pnpm install` in the repo folder. This is required to install some git hooks which do linting & formatting.
- Also, create a new branch out of master branch with the name as `fix-{ISSUE_ID}-anything-more-here`. For example, if you are working on issue #23 regarding implementing a mobile mode, your branch could be called `fix-23-mobile-mode`.
- All source files are inside the `src` folder. Once you run `pnpm run dev`, make code changes inside `src/` folder and the changes appear automatically in the browser. Except when changes are done in `style.css`, that requires manual refresh in brower.
- Once you are done, open a pull request here by selecting right branch: [https://github.com/chinchang/web-maker/compare](https://github.com/chinchang/web-maker/compare).

### Project folder structure

- **docs/**: Online documentation.
- **icons/**: Icons for Chrome extension.
- **app/**: Generated public directory for the web app. Should NOT be edited.
- **src/\*.js**: Mostly services/utilities are here. But some miscellaneous files are lying here that need cleanup.
- **src/components**: Every (well mostly) in ZenUML is a component. Find them here.
- **src/lib**: 3rd party code that are loaded conditionally in the app and thus are not part of either the final `script.js` or `vendor.js`.
- **src/lib/transpilers**: Various transpilers to convert preprocessor code.
- **src/assets**: Images are kept here.
- **src/templates**: JSON files for all templates support inside ZenUML.
- **src/tests**: Tests, right.
