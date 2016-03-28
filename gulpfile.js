var gulp        = require('gulp'),
    data        = require('gulp-data'),
    swig        = require('gulp-swig'),
    $           = require('gulp-load-plugins')(),
    path        = require('path'),
    browserSync = require('browser-sync'),
    through2    = require('through2'),
    reload      = browserSync.reload,
    browserify  = require('browserify'),
    del         = require('del'),
    argv        = require('yargs').argv,
    marked      = require('marked');

gulp.task('browser-sync', function() {
  browserSync({
    open: !!argv.open,
    notify: !!argv.notify,
    server: {
      baseDir: "./dist"
    }
  });
});

gulp.task('heroku-server', function(){
  browserSync({
    open: false,
    notify: false,
    server: {
      baseDir: "./dist",
    },
    port: process.env.PORT,
    ghostMode: false
  })
});

gulp.task('sass', function() {
  return gulp.src('./src/stylesheets/**/*.{scss,sass}')
    .pipe($.plumber())
    .pipe($.sass({
      css: 'dist/stylesheets',
      sass: 'src/stylesheets'
    })).on('error', function(error){
      console.log(error.stack);
      this.emit('end')
    })
    .pipe(gulp.dest('dist/stylesheets'));
});

gulp.task('fonts', function(){
  return gulp.src('./src/fonts/*')
  .pipe(gulp.dest('dist/fonts'));
});


gulp.task('js', function() {
  return gulp.src('src/scripts/app.js')
    .pipe($.plumber())
    .pipe(through2.obj(function (file, enc, next) {
      browserify(file.path, { debug: true })
        .transform(require('babelify'))
        .transform(require('debowerify'))
        .bundle(function (err, res) {
          if (err) { return next(err); }
          file.contents = res;
            next(null, file);
        });
      }))
      .on('error', function (error) {
        console.log(error.stack);
        this.emit('end');
    })
  .pipe( $.rename('app.js'))
  .pipe( gulp.dest('dist/scripts/'));
});


gulp.task('clean', function(cb) {
  del('./dist', cb);
});

gulp.task('images', function() {
  return gulp.src('./src/images/**/*')
    .pipe($.imagemin({
      progressive: true
    }))
    .pipe(gulp.dest('./dist/images'))
})

gulp.task('templates', function() {
  return gulp.src('src/**/*.jade')
    .pipe($.plumber())
    .pipe(data(function(file) {
      return {
        'file': require('./json/data.json'),
        'md': require('marked')
      }
    }))
    .pipe($.swig({defaults: { cache: false }}))
    .pipe($.jade({
      pretty: true
    }))
    .pipe( gulp.dest('dist/') )
});

gulp.task('build', ['fonts', 'sass', 'js', 'templates', 'images']);

gulp.task('serve', ['build', 'browser-sync'], function () {
  gulp.watch('src/stylesheets/**/*.{scss,sass}',['sass', reload]);
  gulp.watch('src/scripts/**/*.js',['js', reload]);
  gulp.watch('src/images/**/*',['images', reload]);
  gulp.watch('src/*.jade',['templates', reload]);
  gulp.watch('json/*.json',['templates', reload]);
});

gulp.task('heroku:prod', ['build', 'heroku-server']);

gulp.task('default', ['serve']);
