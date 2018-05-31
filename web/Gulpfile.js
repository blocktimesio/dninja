var gulp = require('gulp');
var server = require('gulp-express');
var stylus = require('gulp-stylus');
var babel = require('gulp-babel');
var concat = require("gulp-concat");
var uglify = require('gulp-uglify');

gulp.task('server', function () {
  server.run(['app.js'], {}, false);

  // Restart the server when file changes
  gulp.watch(['app/config/**/*.js'], server.run);
  gulp.watch(['app/**/*.js'], server.run);
  gulp.watch(['app/controllers/**/*.js'], server.run);
  gulp.watch(['app/models/**/*.js'], server.run);
  gulp.watch(['app/views/**/*.js'], server.run);
  gulp.watch(['app/views/**/*.pug'], server.run);
  gulp.watch(['app/views/**/**/*.pug'], server.run);
  gulp.watch(['app.js'], server.run);

  gulp.watch(['app/resources/css/*.styl'], ['stylCompile']);
  gulp.watch(['src/js/*.js'], ['jsBuild']);
});

gulp.task('stylCompile', function () {
  return gulp.src('./app/resources/css/*.styl')
    .pipe(stylus({
      'include css': true,
    }))
    .pipe(gulp.dest('./app/public/css'));
});

gulp.task('jsBuild', function () {
  return gulp.src('./src/js/*.js')
    .pipe(babel({
      presets: ['env'],
    }))
    .pipe(concat('bt.js'))
    .pipe(uglify())
    .pipe(gulp.dest('./app/public/js/build'));
});

gulp.task('default', ['stylCompile', 'jsBuild', 'server'], function () {

});
