const gulp = require('gulp');
const gulpif = require('gulp-if');
const sourcemaps = require('gulp-sourcemaps');
const babel = require('gulp-babel');

const argv = require('minimist')(process.argv.slice(2));

const isDev = argv.dev || false;

gulp.task('js', () => gulp.src([
  'src/**/*.js',
  'src/**/*.jsx',
  '!src/**/*.test.js',
  '!src/**/*.test.jsx',
])
  .pipe(gulpif(isDev, sourcemaps.init()))
  .pipe(babel())
  .pipe(gulpif(isDev, sourcemaps.write({ sourceRoot: '/g3-ui/' })))
  .pipe(gulp.dest('dist')));

gulp.task('default', gulp.series('js'));
