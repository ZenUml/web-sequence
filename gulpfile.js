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
const fsUtil = require('./fs-util');
var packageJson = JSON.parse(fs.readFileSync('./package.json'));

function minifyJs(fileName) {
	const content = fs.readFileSync(fileName, 'utf8');
	const minifiedContent = babelMinify(
		content,
		{ mangle: content.length < 700000 },
		{ sourceMaps: false }
	).code;
	fs.writeFileSync(fileName, minifiedContent);
	console.log(
		`[${fileName}]: ${content.length / 1024}K -> ${minifiedContent.length /
		1024}K`
	);
}

gulp.task('copyFiles', function () {

	return merge(
		gulp.src('static/**/*')
			.pipe(gulp.dest('app/static')),
		gulp.src('help/**/*')
			.pipe(gulp.dest('app/help')),
		gulp.src('privacy-policy/*')
			.pipe(gulp.dest('app/privacy-policy')),
		gulp.src('End-User-License-Agreement/*')
			.pipe(gulp.dest('app/End-User-License-Agreement')),
		gulp.src('src/lib/codemirror/theme/*')
			.pipe(gulp.dest('app/lib/codemirror/theme')),
		gulp.src('src/lib/codemirror/mode/**/*')
			.pipe(gulp.dest('app/lib/codemirror/mode')),
		gulp.src('src/lib/transpilers/*').pipe(gulp.dest('app/lib/transpilers')),
		gulp.src('src/lib/prettier-worker.js').pipe(gulp.dest('app/lib/')),
		gulp.src('src/lib/prettier/*').pipe(gulp.dest('app/lib/prettier')),
		gulp.src('src/lib/screenlog.js').pipe(gulp.dest('app/lib')),
		gulp.src('src/lib/paddle.js').pipe(gulp.dest('app/lib')),
		gulp.src('src/lib/gtm.js').pipe(gulp.dest('app/lib')),
		gulp.src('src/lib/vue-sequence-ext.css').pipe(gulp.dest('app/lib')),
		gulp.src('src/assets/*').pipe(gulp.dest('app/assets')),
		gulp.src('src/animation/*').pipe(gulp.dest('app/animation')),
		gulp.src('src/templates/*').pipe(gulp.dest('app/templates')),
		gulp.src(`src/lib/vue-sequence-bundle.*.js`).pipe(gulp.dest('app/lib')),
		gulp.src('icons/*').pipe(gulp.dest('app/icons')),
		gulp.src(['help.html','ZenUML_Sequence_Diagram_addon_help.html',
			'src/detached-window.js',
			'src/icon-16.png',
			'src/icon-48.png',
			'src/icon-128.png',
			'manifest.json'
		]).pipe(gulp.dest('app')),
		gulp.src('build/*.js')
			.pipe(gulp.dest('app')),
		gulp.src('build/*.css')
			.pipe(gulp.dest('app')),
		// Following CSS are copied to build/ folder where they'll be referenced by
		// useRef plugin to concat into one.
		gulp.src('src/lib/codemirror/lib/codemirror.css')
			.pipe(gulp.dest('build/lib/codemirror/lib')),
		gulp
			.src('src/lib/codemirror/addon/hint/show-hint.css')
			.pipe(gulp.dest('build/lib/codemirror/addon/hint')),
		gulp
			.src('src/lib/codemirror/addon/fold/foldgutter.css')
			.pipe(gulp.dest('build/lib/codemirror/addon/fold')),
		gulp
			.src('src/lib/codemirror/addon/dialog/dialog.css')
			.pipe(gulp.dest('build/lib/codemirror/addon/dialog')),
		gulp.src('src/lib/hint.min.css').pipe(gulp.dest('build/lib')),
		gulp.src('src/lib/inlet.css').pipe(gulp.dest('build/lib')),
		gulp.src('src/style.css').pipe(hashFilename()).pipe(gulp.dest('build')),
		gulp.src('src/preview.html').pipe(gulp.dest('build')),
		gulp.src([
			'src/FiraCode.ttf',
			'src/FixedSys.ttf',
			'src/Inconsolata.ttf',
			'src/Monoid.ttf'
		])
			.pipe(gulp.dest('app'))
	);
});

// Generate script.js, vendor.js, style.css and vendor.css and index.html under ./app/
gulp.task('useRef', function () {
	return gulp
		.src('build/*.html')
		.pipe(useref())
		.pipe(gulp.dest('app'));
});

const bundleJs = () => fsUtil.getBundleJs('build')

gulp.task('concat', function () {
	// TODO: Don't understand what does it do
	gulp
		.src([`app/${bundleJs()}`])
		.pipe(concat(bundleJs()))
		.pipe(gulp.dest('app'));
});

gulp.task('minify', function () {
	minifyJs(`app/${bundleJs()}`);
	minifyJs('app/lib/screenlog.js');

	gulp
		.src('app/*.css')
		.pipe(
			cleanCSS(
				{
					debug: true
				},
				details => {
					console.log(`${details.name}: ${details.stats.originalSize}`);
					console.log(`${details.name}: ${details.stats.minifiedSize}`);
				}
			)
		)
		.pipe(gulp.dest('app'));
});

gulp.task('fixIndex', function () {
	var contents = fs.readFileSync('build/index.html', 'utf8');
	// style.css is replaced with style-[hash].css
	contents = contents.replace(/style\.css/g, fsUtil.getHashedFile('build', 'style-', 'css'));
	fs.writeFileSync('build/index.html', contents, 'utf8');
	contents = fs.readFileSync('build/preview.html', 'utf8');
	// style.css is replaced with style-[hash].css
	contents = contents.replace(/style\.css/g, fsUtil.getHashedFile('build', 'style-', 'css'));
	fs.writeFileSync('build/preview.html', contents, 'utf8');
});

gulp.task('packageExtension', function () {
	childProcess.execSync('cp -R app/ extension');
	childProcess.execSync('cp src/manifest.json extension');
	childProcess.execSync('cp src/options.js extension');
	childProcess.execSync('cp src/options.html extension');
	childProcess.execSync('cp src/eventPage.js extension');
	childProcess.execSync('cp src/icon-16.png extension');
	childProcess.execSync('cp src/icon-48.png extension');
	childProcess.execSync('cp src/icon-128.png extension');
	childProcess.execSync(
		'rm -rf extension/partials'
	);
	return merge(
		gulp
			.src('build/bundle.*.js')
			.pipe(gulp.dest('extension')),
		gulp
			.src('extension/**/*')
			.pipe(zip(`extension.zip`))
			.pipe(gulp.dest('./'))
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
		}
	);
});
