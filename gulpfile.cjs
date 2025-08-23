/*eslint-env node*/

const fs = require('fs');
const gulp = require('gulp');
const runSequence = require('run-sequence');
const useref = require('gulp-useref');
const cleanCSS = require('gulp-clean-css');
const concat = require('gulp-concat');
const babelMinify = require('babel-minify');
const childProcess = require('child_process');
const merge = require('merge-stream');
const zip = require('gulp-zip');
const hashFilename = require('gulp-hash-filename');
const fsUtil = require('./fs-util.cjs');
var packageJson = JSON.parse(fs.readFileSync('./package.json'));

function minifyJs(fileName) {
  const content = fs.readFileSync(fileName, 'utf8');
  const minifiedContent = babelMinify(
    content,
    { mangle: content.length < 700000 },
    { sourceMaps: false },
  ).code;
  fs.writeFileSync(fileName, minifiedContent);
  console.log(
    `[${fileName}]: ${content.length / 1024}K -> ${
      minifiedContent.length / 1024
    }K`,
  );
}

gulp.task('copyFiles', function () {
  return merge(
    // Copy static assets
    gulp.src('static/**/*').pipe(gulp.dest('app/static')),
    gulp.src('help/**/*').pipe(gulp.dest('app/help')),
    gulp.src('privacy-policy/*').pipe(gulp.dest('app/privacy-policy')),
    gulp
      .src('End-User-License-Agreement/*')
      .pipe(gulp.dest('app/End-User-License-Agreement')),

    // Copy library files that are still needed
    gulp
      .src('src/lib/codemirror/lib/*')
      .pipe(gulp.dest('app/lib/codemirror/lib')),
    gulp
      .src('src/lib/codemirror/theme/*')
      .pipe(gulp.dest('app/lib/codemirror/theme')),
    gulp
      .src('src/lib/codemirror/mode/**/*')
      .pipe(gulp.dest('app/lib/codemirror/mode')),
    gulp.src('src/lib/transpilers/*').pipe(gulp.dest('app/lib/transpilers')),
    gulp.src('src/lib/prettier-worker.js').pipe(gulp.dest('app/lib/')),
    gulp.src('src/lib/prettier/*').pipe(gulp.dest('app/lib/prettier')),
    gulp.src('src/lib/screenlog.js').pipe(gulp.dest('app/lib')),
    gulp.src('src/lib/paddle.js').pipe(gulp.dest('app/lib')),
    gulp.src('src/lib/gtm.js').pipe(gulp.dest('app/lib')),
    gulp.src('src/lib/sequence-ext.css').pipe(gulp.dest('app/lib')),
    gulp.src('src/assets/*').pipe(gulp.dest('app/assets')),
    gulp.src('src/animation/*').pipe(gulp.dest('app/animation')),
    gulp.src('src/templates/*').pipe(gulp.dest('app/templates')),
    gulp.src('icons/*').pipe(gulp.dest('app/icons')),

    // Copy root files
    gulp
      .src([
        'help.html',
        'ZenUML_Sequence_Diagram_addon_help.html',
        'src/detached-window.js',
        'src/icon-16.png',
        'src/icon-48.png',
        'src/icon-128.png',
        'static/manifest.json',
      ])
      .pipe(gulp.dest('app')),

    // Copy Vite build output from dist/ instead of build/
    gulp.src('dist/**/*').pipe(gulp.dest('app')),

    // Copy fonts
    gulp
      .src([
        'src/FiraCode.ttf',
        'src/FixedSys.ttf',
        'src/Inconsolata.ttf',
        'src/Monoid.ttf',
      ])
      .pipe(gulp.dest('app')),
  );
});

// This task is no longer needed since Vite handles HTML processing
gulp.task('useRef', function (callback) {
  // Skip useRef since Vite already processes HTML files
  callback();
});

// This task is no longer needed since Vite handles bundling
gulp.task('concat', function (callback) {
  // Skip concat since Vite already handles bundling
  callback();
});

gulp.task('minify', function () {
  // Only minify specific files that need additional processing
  if (fs.existsSync('app/lib/screenlog.js')) {
    minifyJs('app/lib/screenlog.js');
  }

  // Minify CSS files if they exist
  if (fs.existsSync('app') && fs.readdirSync('app').some(file => file.endsWith('.css'))) {
    gulp
      .src('app/*.css')
      .pipe(
        cleanCSS(
          {
            debug: true,
          },
          (details) => {
            console.log(`${details.name}: ${details.stats.originalSize}`);
            console.log(`${details.name}: ${details.stats.minifiedSize}`);
          },
        ),
      )
      .pipe(gulp.dest('app'));
  }
});

// This task is no longer needed since Vite handles file processing
gulp.task('fixIndex', function (callback) {
  // Skip fixIndex since Vite already handles HTML processing with proper hashing
  callback();
});

gulp.task('packageExtension', function () {
  childProcess.execSync('cp -R app/ extension');
  childProcess.execSync('cp static/manifest.json extension');  // manifest.json is in root, not src/
  childProcess.execSync('cp src/extension/options.js extension');
  childProcess.execSync('cp src/extension/options.html extension');
  childProcess.execSync('cp src/extension/eventPage.js extension');
  childProcess.execSync('cp src/extension/script.js extension');

  // Copy icon files for Chrome Extension
  if (fs.existsSync('static/favicon-128x128.png')) {
    childProcess.execSync('cp static/favicon-128x128.png extension');
  }
  if (fs.existsSync('static/icon-16.png')) {
    childProcess.execSync('cp static/icon-16.png extension');
  }
  if (fs.existsSync('static/icon-48.png')) {
    childProcess.execSync('cp static/icon-48.png extension');
  }

  childProcess.execSync('rm -rf extension/partials');
  return merge(
    // Copy any additional JS files from dist if they exist
    gulp.src('dist/assets/*.js', { allowEmpty: true }).pipe(gulp.dest('extension/assets')),
    gulp.src('extension/**/*').pipe(zip(`extension.zip`)).pipe(gulp.dest('./')),
  );
});

gulp.task('cleanup', function () {
  return childProcess.execSync('rm -rf app extension');
});

gulp.task('cleanup-build', function () {
  return childProcess.execSync('rm -rf build');
});

gulp.task('release', function (callback) {
  runSequence(
    'cleanup',
    'copyFiles',
    'fixIndex',
    'useRef',
    'concat',
    'minify',
    'packageExtension',
    function (error) {
      if (error) {
        console.log(error.message);
      } else {
        console.log('RELEASE FINISHED SUCCESSFULLY');
      }
      callback(error);
    },
  );
});
