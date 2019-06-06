if (typeof window === 'undefined') {
  const jsdom = require("jsdom");
  const { JSDOM } = jsdom;
  const dom = new JSDOM();
  global.window = dom.window;
  global.document = dom.window.document;
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

const suite = new Benchmark.Suite();

function generateDeepObjectFixture() {
  return {
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
  }
}

function generateSmallObjectFixture() {
  return { name: 'Tesla', speed: 100 };
}

function generateBigObjectFixture(carsSize) {
  const obj = {
    firstName: 'Albert',
    lastName: 'Einstein',
    cars: []
  };
  for (let i = 0; i < carsSize; i++) {
    let deep = generateSmallObjectFixture();
    obj.cars.push(deep);
    for (let j = 0; j < 5; j++) {
      deep.temp = generateSmallObjectFixture();
      deep = deep.temp;
    }
  }
  return obj;
}

suite.add('jsonpatcherproxy generate operation', function() {
  const obj = generateDeepObjectFixture();
  const jsonPatcherProxy = new JSONPatcherProxy(obj);
  const observedObj = jsonPatcherProxy.observe(true);
  const patches = jsonPatcherProxy.generate();
  observedObj.firstName = 'Joachim';
  observedObj.lastName = 'Wester';
  observedObj.phoneNumbers[0].number = '123';
  observedObj.phoneNumbers[1].number = '456';
});

suite.add('jsonpatch generate operation', function() {
  const obj = generateDeepObjectFixture();
  const observer = jsonpatch.observe(obj);
  obj.firstName = 'Joachim';
  obj.lastName = 'Wester';
  obj.phoneNumbers[0].number = '123';
  obj.phoneNumbers[1].number = '456';
  jsonpatch.generate(observer);
});

suite.add('jsonpatcherproxy mutation - huge object', function() {
  const obj = generateBigObjectFixture(100);
  const jsonPatcherProxy = new JSONPatcherProxy(obj);
  const observedObj = jsonPatcherProxy.observe(true);
  observedObj.cars[50].name = 'Toyota'
});

suite.add('jsonpatch mutation - huge object', function() {
  const obj = generateBigObjectFixture(100);
  const observer = jsonpatch.observe(obj);
  obj.cars[50].name = 'Toyota';
  jsonpatch.generate(observer);
});

suite.add('jsonpatcherproxy generate operation - huge object', function() {
  const obj = generateBigObjectFixture(100);
  const jsonPatcherProxy = new JSONPatcherProxy(obj);
  const observedObj = jsonPatcherProxy.observe(true);
  observedObj.cars.shift();
});

suite.add('jsonpatch generate operation - huge object', function() {
  const obj = generateBigObjectFixture(100);
  const observer = jsonpatch.observe(obj);
  obj.cars.shift();
  jsonpatch.generate(observer);
});

suite.add('PROXIFY big object', function() {
  const obj = generateBigObjectFixture(50);
  const jsonPatcherProxy = new JSONPatcherProxy(obj);
  const observedObj = jsonPatcherProxy.observe(true);
  observedObj.a = 1;
});

suite.add('DIRTY-OBSERVE big object', function() {
  const obj = generateBigObjectFixture(50);
  const observer = jsonpatch.observe(obj);
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