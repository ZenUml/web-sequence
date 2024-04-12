We encountered the same issue when updating a legacy project depending on `gulp@3.9.1` to Node.js 12+.

These fixes enable you to use Node.js 12+ with `gulp@3.9.1` by overriding `graceful-fs` to version `^4.2.4`.

## If you are using yarn v1

Yarn v1 [supports resolving a package to a defined version][2].
You need to add a `resolutions` section to your `package.json`:

```json
{
  // Your current package.json contents
  "resolutions": {
    "graceful-fs": "^4.2.4"
  }
}
```

Thanks [@jazd][3] for this way to solve the issue.

## If you are using npm

Using [`npm-force-resolutions`][4] as a preinstall script, you can obtain a similar result as with yarn v1. You need to modify your package.json this way:

```json
{
  // Your current package.json
  "scripts": {
    // Your current package.json scripts
    "preinstall": "npx npm-force-resolutions"
  },
  "resolutions": {
    "graceful-fs": "^4.2.4"
  }
}
```

`npm-force-resolutions` will alter the `package-lock.json` file to set `graceful-fs`to the wanted version before the `install` is done.

If you are using a custom `.npmrc` file in your project and it contains either a proxy or custom registry, you might need to change `npx npm-force-resolutions` to `npx --userconfig .npmrc npm-force-resolutions` because as of now, `npx` doesn't use the current folder `.npmrc` file by default.

## Origin of the problem

This issue stems from the fact that `gulp@3.9.1` [depends][5] on `graceful-fs@^3.0.0` which monkeypatches Node.js `fs` module.

This used to work with Node.js until version 11.15 (which is a [version][6] from a development branch and shouldn't be used in production).

[`graceful-fs@^4.0.0`][7] does not monkeypatch Node.js `fs` module anymore, which makes it compatible with Node.js > 11.15 (tested and working with versions 12 and 14).

Note that this is not a perennial solution but it helps when you don't have the time to update to `gulp@^4.0.0`.

[1]: https://docs.npmjs.com/files/shrinkwrap.json
[2]: https://classic.yarnpkg.com/en/docs/selective-version-resolutions/
[3]: https://stackoverflow.com/users/1650473/jazd
[4]: https://github.com/rogeriochaves/npm-force-resolutions
[5]: https://github.com/gulpjs/gulp/blob/v3.9.1/package.json#L47
[6]: https://nodejs.org/en/about/releases/
[7]: https://github.com/isaacs/node-graceful-fs#v4
