function unitCountonFeatures(allFeaturesList, systems) {
    // constrain output ot only features in the list. 
    var constraintedFeatures = { "type": "FeatureCollection", "features": [] };
    var allFeatures = JSON.parse(allFeaturesList);
    var systems = JSON.parse(systems);
    var sysUnits = {};
    for (var i = 0; i < systems.length; i++) {
        var element = systems[i];
        sysUnits[element['sysname']] = 0;
    }

    var af = allFeatures.features;
    var featlen = af.length;
    var counter = 0;
    var fullproc = featlen;
    for (var d = 0; d < featlen; d++) {
        var curfeatprop = af[d].properties;
        var curFeatSys = curfeatprop.sysname;
        var isStreet = curfeatprop.isStreet;
        if (isStreet) {} else {

            if (curfeatprop.hasOwnProperty('totalunits')) {
                if (curfeatprop.totalunits === parseInt(curfeatprop.totalunits, 10)) {
                    sysUnits[curFeatSys] += curfeatprop.totalunits;
                }
            }
        }
        // counter += 1;
        // self.postMessage({
        //     'percentcomplete': parseInt((100 * counter) / fullproc),
        //     'mode': 'status',
        // });
    }

    self.postMessage({
        'sysUnits': JSON.stringify(sysUnits)
    });
}

self.onmessage = function(e) {
    unitCountonFeatures(e.data.allFeaturesList, e.data.systems);
}