# Web Sequence

[![HitCount](http://hits.dwyl.com/zenuml/web-sequence.svg?style=flat-square)](http://hits.dwyl.com/zenuml/web-sequence)
[![Go to Web App](https://img.shields.io/badge/go%20to-web%20app-brightgreen)](https://app.zenuml.com)

**Web Sequence** is a Free Sequence Diagram Online tool that converts your Chrome tab into a sequence diagram generator.

![Screenshot](/screenshots/ss1.png)

## Table of Contents

- [Web Sequence](#web-sequence)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
    - [Features](#features)
  - [Development](#development)
  - [CI/CD](#cicd)
    - [Staging environment](#staging-environment)
    - [Production environment](#production-environment)
  - [Support](#support)
  - [Acknowledgements](#acknowledgements)
    - [License](#license)

## Installation

1. Web App - https://app.zenuml.com
2. Chrome Extension - [Chrome Web Store - ZenUML Sequence](https://chrome.google.com/webstore/detail/web-sequence/kcpganeflmhffnlofpdmcjklmdpbbmef).

### Features

- Supports method call, internal method, alt (if/else) and loop (for, foreach, while) keywords
- Works offline
- Save and load your creations
- Auto-save feature
- Code auto-completion
- Import & Export all creations anytime, anywhere
- Multiple editor themes & other configurable settings
- Font options + use any system font!
- Very easily accessible. Simply open a new tab in Chrome! (in chrome extension only)
- Capture preview screenshot (in Chrome extension only)

Follow [@ZenUml](https://twitter.com/intent/follow?screen_name=ZenUml) for updates or tweet out feature requests and suggestions.

## Development

```
$ pnpm install  // install modules
$ pnpm start    // start a local server

$ pnpm build    // build a staging release
$ pnpm release  // copy resources to app / extension
```

## CI/CD

### Staging environment

1. When a PR is created or updated, a **preview** site will be created, and you can find the link in the PR page.
2. When a PR is merged into `master` branch, a **staging** site will be created. The link to the staging site is https://staging.zenuml.com.

### Production environment

Create a tag as `release-<version>`, and push it to the remote. It doesn't matter which branch you are on. The CI/CD
pipeline will create a production release. The link to the production site is https://app.zenuml.com.

## Support

Web Sequence is completely free and open-source. If you find it useful, you can show your support by sharing it in your
social network or by simply letting me know how much you 💖 it by tweeting to [@ZenUml](https://twitter.com/ZenUml).

## Acknowledgements

- This project is a fork of [Web Maker](https://github.com/chinchang/web-maker)
- The diagram generator is built on top of [VueJs](https://vuejs.org/)

### License

MIT Licensed

Copyright (c) 2023 Peng Xiao, [ZenUml.com](http://ZenUml.com)
