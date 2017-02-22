var obj, obj2, patches;
if (typeof window === 'undefined') {
    var jsdom = require("jsdom").jsdom;
    var doc = jsdom(undefined, undefined);
    global.window = doc.defaultView;
    global.document = doc.defaultView.document;
}

if (typeof jsonpatch === 'undefined') {
    jsonpatch = require('fast-json-patch');
}

if (typeof JSONPatcherProxy === 'undefined') {
    JSONPatcherProxy = require('../../dist/jsonpatcherproxy.js');
}

if (typeof Benchmark === 'undefined') {
    var Benchmark = require('benchmark');
    var benchmarkResultsToConsole = require('./../helpers/benchmarkReporter.js').benchmarkResultsToConsole;
}

console.log("Benchmark: Proxy");

var suite = new Benchmark.Suite;
suite.add('generate operation', function() {

    var obj = {
        firstName: "Albert",
        lastName: "Einstein",
        phoneNumbers: [{
            number: "12345"
        }, {
            number: "45353"
        }]
    };

    var jsonPatcherProxy = new JSONPatcherProxy(obj);
    var observedObj = jsonPatcherProxy.observe(true);

    patches = jsonPatcherProxy.generate();    

    observedObj.firstName = "Joachim";
    observedObj.lastName = "Wester";
    observedObj.phoneNumbers[0].number = "123";
    observedObj.phoneNumbers[1].number = "456";

    patches = jsonPatcherProxy.generate();
    obj2 = {
        firstName: "Albert",
        lastName: "Einstein",
        phoneNumbers: [{
            number: "12345"
        }, {
            number: "45353"
        }]
    };

    jsonpatch.apply(obj2, patches);
});
suite.add('compare operation', function() {
    var obj = {
        firstName: "Albert",
        lastName: "Einstein",
        phoneNumbers: [{
            number: "12345"
        }, {
            number: "45353"
        }]
    };
    var obj2 = {
        firstName: "Joachim",
        lastName: "Wester",
        mobileNumbers: [{
            number: "12345"
        }, {
            number: "45353"
        }]
    };

    var patches = jsonpatch.compare(obj, obj2);
});

// if we are in the browser with benchmark < 2.1.2
if(typeof benchmarkReporter !== 'undefined'){
    benchmarkReporter(suite);
} else {
    suite.on('complete', function () {
        benchmarkResultsToConsole(suite);
    });
    suite.run();
}
