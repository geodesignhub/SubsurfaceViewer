// processor.js
var redisclient = require('redis').createClient(process.env.REDIS_URL || { host: 'localhost', port: 6379 });

var tools = require('./3Dprocessor/tools');
module.exports = function(job) {
    // Do some heavy work

    console.log('Computation starting..');
    var tmp = tools.generate3DGeoms(JSON.parse(job.data.gj), 1, job.data.rfc, JSON.parse(job.data.sys));

    console.log('Computation finished, counting units..');
    // job.progress(50);
    const final3DGeoms = tmp[0];
    const center = tmp[1];
    var unitCounts = tools.unitCountonFeatures(final3DGeoms, JSON.parse(job.data.sys));
    // job.progress(100);
    console.log('Computation Complete..');
    redisclient.set(job.data.synthesisid, JSON.stringify({ "finalGeoms": final3DGeoms, "center": center, "unitCounts": unitCounts }));

    return Promise.resolve(job.data.synthesisid);
}