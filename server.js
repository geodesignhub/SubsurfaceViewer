(function() {
    'use strict';
    /*jshint node:true*/

    var express = require('express');
    var bodyParser = require('body-parser');
    var compression = require('compression');
    var url = require('url');
    var req = require('request');
    var async = require('async');
    var yargs = require('yargs').options({
        'port': {
            'default': 5000,
            'description': 'Port to listen on.'
        },
        'public': {
            'type': 'boolean',
            'description': 'Run a public server that listens on all interfaces.'
        },
        'upstream-proxy': {
            'description': 'A standard proxy server that will be used to retrieve data.  Specify a URL including port, e.g. "http://proxy:8000".'
        },
        'bypass-upstream-proxy-hosts': {
            'description': 'A comma separated list of hosts that will bypass the specified upstream_proxy, e.g. "lanhost1,lanhost2"'
        },
        'help': {
            'alias': 'h',
            'type': 'boolean',
            'description': 'Show this help.'
        }
    });
    var argv = yargs.argv;

    if (argv.help) {
        return yargs.showHelp();
    }

    // eventually this mime type configuration will need to change
    // https://github.com/visionmedia/send/commit/d2cb54658ce65948b0ed6e5fb5de69d022bef941
    // *NOTE* Any changes you make here must be mirrored in web.config.
    var mime = express.static.mime;
    mime.define({
        'application/json': ['czml', 'json', 'geojson', 'topojson'],
        'model/vnd.gltf+json': ['gltf'],
        'model/vnd.gltf.binary': ['bgltf', 'glb'],
        'text/plain': ['glsl']
    });

    var app = express();
    app.use(compression());

    var ejs = require('ejs');
    app.set('view engine', 'ejs');

    app.use(express.static(__dirname + '/views'));
    app.use('/assets', express.static('static'));
    app.use(bodyParser.urlencoded({
        extended: false
    }));
    app.use(bodyParser.json());

    function getRemoteUrlFromParam(req) {
        var remoteUrl = req.params[0];
        if (remoteUrl) {
            // add http:// to the URL if no protocol is present
            if (!/^https?:\/\//.test(remoteUrl)) {
                remoteUrl = 'http://' + remoteUrl;
            }
            remoteUrl = url.parse(remoteUrl);
            // copy query string
            remoteUrl.search = url.parse(req.url).search;
        }
        return remoteUrl;
    }

    var dontProxyHeaderRegex = /^(?:Host|Proxy-Connection|Connection|Keep-Alive|Transfer-Encoding|TE|Trailer|Proxy-Authorization|Proxy-Authenticate|Upgrade)$/i;

    function filterHeaders(req, headers) {
        var result = {};
        // filter out headers that are listed in the regex above
        Object.keys(headers).forEach(function(name) {
            if (!dontProxyHeaderRegex.test(name)) {
                result[name] = headers[name];
            }
        });
        return result;
    }

    var upstreamProxy = argv['upstream-proxy'];
    var bypassUpstreamProxyHosts = {};
    if (argv['bypass-upstream-proxy-hosts']) {
        argv['bypass-upstream-proxy-hosts'].split(',').forEach(function(host) {
            bypassUpstreamProxyHosts[host.toLowerCase()] = true;
        });
    }

    app.get('/', function(request, response) {
        var opts = {};
        if (request.query.apitoken && request.query.projectid && request.query.synthesisid && request.query.cteamid) {
            // synthesis ID is given
            opts = {
                'apitoken': request.query.apitoken,
                'projectid': request.query.projectid,
                'synthesisid': request.query.synthesisid,
                'cteamid': request.query.cteamid,
                'diagramid': '0'
            };
            
            var baseurl = 'https://www.geodesignhub.com/api/v1/projects/';
            // var baseurl = 'http://local.test:8000/api/v1/projects/';

            var apikey = request.query.apitoken;
            var cred = "Token " + apikey;
            var projectid = request.query.projectid;
            var cteamid = request.query.cteamid;
            var synthesisid = request.query.synthesisid;
            var synprojectsurl = baseurl + projectid + '/cteams/' + cteamid + '/' + synthesisid + '/';
            var systemsurl = baseurl + projectid + '/systems/';
            var centerurl = baseurl + projectid + '/center/';
            var boundsurl = baseurl + projectid + '/bounds/';
            var URLS = [synprojectsurl, centerurl, systemsurl, boundsurl];
            
            async.map(URLS, function(url, done) {
                req({
                    url: url,
                    headers: {
                        "Authorization": cred,
                        "Content-Type": "application/json"
                    }
                }, function(err, response, body) {
                    if (err || response.statusCode !== 200) {
                        return done(err || new Error());
                    }
                    return done(null, JSON.parse(body));
                });
            }, function(err, results) {
                if (err) return response.sendStatus(500);
                var gj = JSON.stringify(results[0]);
                var center = results[1];
                var sys = JSON.stringify(results[2]);
                var bounds = results[3];
                opts['result'] = gj;
                opts['systems'] = sys;
                opts['bounds'] = bounds["bounds"];
                opts['center'] = JSON.stringify(center['center']);
               
                response.render('index', opts);

            });

        } else {
            opts = {
                'apitoken': '0',
                'projectid': '0',
                'diagramid': '0',
                'result': '0',
                'cteamid': '0',
                'systems': '0',
                'synthesisid': '0',
                'center': '0',
            };
            response.render('index', opts);
        }

    });


    // var server = app.listen(process.env.PORT || 5000, argv.public ? undefined : 'localhost', function() {
    //     if (argv.public) {
    //         console.log('Cesium development server running publicly.  Connect to http://localhost:%d/', server.address().port);
    //     } else {
    //         console.log('Cesium development server running locally.  Connect to http://localhost:%d/', server.address().port);
    //     }
    // });

    var server = app.listen(process.env.PORT || 5001); // for Heroku
    server.on('error', function(e) {
        if (e.code === 'EADDRINUSE') {
            console.log('Error: Port %d is already in use, select a different port.', argv.port);
            console.log('Example: node server.js --port %d', argv.port + 1);
        } else if (e.code === 'EACCES') {
            console.log('Error: This process does not have permission to listen on port %d.', argv.port);
            if (argv.port < 1024) {
                console.log('Try a port number higher than 1024.');
            }
        }
        console.log(e);
        process.exit(1);
    });

    server.on('close', function() {
        console.log('Cesium development server stopped.');
    });

    var isFirstSig = true;
    process.on('SIGINT', function() {
        if (isFirstSig) {
            console.log('Cesium development server shutting down.');
            server.close(function() {
                process.exit(0);
            });
            isFirstSig = false;
        } else {
            console.log('Cesium development server force kill.');
            process.exit(1);
        }
    });

})();