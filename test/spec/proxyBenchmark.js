var obj, obj2;

if (typeof window === 'undefined') {
  var jsdom = require('jsdom').jsdom;
  var doc = jsdom(undefined, undefined);
  global.window = doc.defaultView;
  global.document = doc.defaultView.document;
}

if (typeof jsonpatch === 'undefined') {
  jsonpatch = require('fast-json-patch');
}

if (typeof JSONPatcherProxy === 'undefined') {
  JSONPatcherProxy = require('../../src/jsonpatcherproxy.js');
}

if (typeof Benchmark === 'undefined') {
  var Benchmark = require('benchmark');
  var benchmarkResultsToConsole = require('./../helpers/benchmarkReporter.js')
    .benchmarkResultsToConsole;
}

var suite = new Benchmark.Suite();

suite.add('jsonpatcherproxy generate operation', function() {
  var obj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    phoneNumbers: [
      {
        number: '12345'
      },
      {
        number: '45353'
      }
    ]
  };

  var jsonPatcherProxy = new JSONPatcherProxy(obj);
  var observedObj = jsonPatcherProxy.observe(true);

  var patches = jsonPatcherProxy.generate();

  observedObj.firstName = 'Joachim';
  observedObj.lastName = 'Wester';
  observedObj.phoneNumbers[0].number = '123';
  observedObj.phoneNumbers[1].number = '456';
});
suite.add('jsonpatch generate operation', function() {
  var observedObj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    phoneNumbers: [
      {
        number: '12345'
      },
      {
        number: '45353'
      }
    ]
  };
  var observer = jsonpatch.observe(observedObj);

  observedObj.firstName = 'Joachim';
  observedObj.lastName = 'Wester';
  observedObj.phoneNumbers[0].number = '123';
  observedObj.phoneNumbers[1].number = '456';

  jsonpatch.generate(observer);
});





suite.add('jsonpatcherproxy mutation - huge object', function() {
  var singleCar = { name: 'Tesla', speed: 100 };

  var obj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    cars: []
  };

  for (var i = 0; i < 100; i++) {
    var copy = JSONPatcherProxy.deepClone(singleCar);
    var temp = copy;
    for (var j = 0; j < 5; j++) {
      temp.temp = JSONPatcherProxy.deepClone(singleCar);
      temp = temp.temp;
    }
    obj.cars.push(copy);
  }
  var jsonPatcherProxy = new JSONPatcherProxy(obj);
  var observedObj = jsonPatcherProxy.observe(true);

  observedObj.cars[50].name = 'Toyota'
});

suite.add('jsonpatch mutation - huge object', function() {
  var singleCar = { name: 'Tesla', speed: 100 };

  var obj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    cars: []
  };

  for (var i = 0; i < 100; i++) {
    var copy = JSONPatcherProxy.deepClone(singleCar);
    var temp = copy;
    for (var j = 0; j < 5; j++) {
      temp.temp = JSONPatcherProxy.deepClone(singleCar);
      temp = temp.temp;
    }
    obj.cars.push(copy);
  }

  var observer = jsonpatch.observe(obj);

  obj.cars[50].name = 'Toyota';

  jsonpatch.generate(observer);
});

suite.add('jsonpatcherproxy generate operation - huge object', function() {
  var singleCar = { name: 'Tesla', speed: 100 };

  var obj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    cars: []
  };

  for (var i = 0; i < 100; i++) {
    var copy = JSONPatcherProxy.deepClone(singleCar);
    var temp = copy;
    for (var j = 0; j < 5; j++) {
      temp.temp = JSONPatcherProxy.deepClone(singleCar);
      temp = temp.temp;
    }
    obj.cars.push(copy);
  }
  var jsonPatcherProxy = new JSONPatcherProxy(obj);
  var observedObj = jsonPatcherProxy.observe(true);

  observedObj.cars.shift();
});

suite.add('jsonpatch generate operation - huge object', function() {
  var singleCar = { name: 'Tesla', speed: 100 };

  var obj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    cars: []
  };

  for (var i = 0; i < 100; i++) {
    var copy = JSONPatcherProxy.deepClone(singleCar);
    var temp = copy;
    for (var j = 0; j < 5; j++) {
      temp.temp = JSONPatcherProxy.deepClone(singleCar);
      temp = temp.temp;
    }
    obj.cars.push(copy);
  }

  var observer = jsonpatch.observe(obj);

  obj.cars.shift();

  jsonpatch.generate(observer);
});

suite.add('PROXIFY big object', function() {
  var singleCar = { name: 'Tesla', speed: 100 };

  var obj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    cars: []
  };
  for (var i = 0; i < 50; i++) {
    var copy = JSONPatcherProxy.deepClone(singleCar);
    var temp = copy;
    for (var j = 0; j < 5; j++) {
      temp.temp = JSONPatcherProxy.deepClone(singleCar);
      temp = temp.temp;
    }
    obj.cars.push(copy);
  }

  var jsonPatcherProxy = new JSONPatcherProxy(obj);

  var observedObj = jsonPatcherProxy.observe(true);
  observedObj.a = 1;
});

suite.add('DIRTY-OBSERVE big object', function() {
  var singleCar = { name: 'Tesla', speed: 100 };

  var obj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    cars: []
  };
  for (var i = 0; i < 50; i++) {
    var copy = JSONPatcherProxy.deepClone(singleCar);
    var temp = copy;
    for (var j = 0; j < 5; j++) {
      temp.temp = JSONPatcherProxy.deepClone(singleCar);
      temp = temp.temp;
    }
    obj.cars.push(copy);
  }
  var observer = jsonpatch.observe(obj);
  obj.a = 1;
  jsonpatch.generate(observer);

});

// if we are in the browser with benchmark < 2.1.2
if (typeof benchmarkReporter !== 'undefined') {
  benchmarkReporter(suite);
} else {
  suite.on('complete', function() {
    benchmarkResultsToConsole(suite);
  });
  suite.run();
}
