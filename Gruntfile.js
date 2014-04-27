module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            dist: {
                files: {
                    'PhoneGap/www/js/build.js': ['PhoneGap/www/js/index.js']
                },
                options: {
                    transform: ['grunt-less-browserify', 'browserify-handlebars']
                }
            },
            test: {
                files: {
                    'examples/build.js':        ['examples/example.js'],
                    'test/build.js':            ['test/test.js']
                },
                options: {
                    transform: ['grunt-less-browserify', 'browserify-handlebars'],
                    debug:     true
                }
            }
        },
        watch: {
            files: ["views/**/*", "models/**/*", "examples/example.js", "node_modules/subview/**/*"],
            tasks: ['browserify:test']
        },
        jshint: {
            options: {
                curly:  true,
                eqeqeq: true,
                eqnull: true,
                browser: true
            },
            uses_defaults: ['src/**/*.js']
        },
        qunit: {
            files: ['test/index.html']
        },
        lessBrowserify: {
            imports: ['node_modules/helpers.less/helpers.less']
        },
        shell: {
            phonegap: {
                command: "cd PhoneGap; sh build.sh",
                options: {
                    stdout: true
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-qunit');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-shell');

    grunt.registerTask('phonegap', [
        'shell:phonegap'
    ]);

    grunt.registerTask('test', [
        'browserify:test',
        'qunit',
        'jshint'
    ]);

    grunt.registerTask('build', [
        'test',
        'browserify:dist',
        'phonegap'
    ]);

    grunt.registerTask('default', [
        'build'
    ]);
};

