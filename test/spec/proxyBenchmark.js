/*
  To run with comparisons:
  $ npm run bench-compare

  To run without comparisons:
  $ npm run bench
  */

let includeComparisons = true;
const isNode = (typeof window === 'undefined');

if (isNode) {
  const jsdom = require("jsdom");
  const { JSDOM } = jsdom;
  const dom = new JSDOM();
  global.window = dom.window;
  global.document = dom.window.document;

  if (!process.argv.includes("--compare")) {
    includeComparisons = false;
  }
}

if (typeof jsonpatch === 'undefined') {
  global.jsonpatch = require('fast-json-patch');
}

if (typeof JSONPatcherProxy === 'undefined') {
  global.JSONPatcherProxy = require('../../src/jsonpatcherproxy.js');
}

if (typeof Benchmark === 'undefined') {
  global.Benchmark = require('benchmark');
  global.benchmarkResultsToConsole = require('./../helpers/benchmarkReporter.js')
    .benchmarkResultsToConsole;
}

const suite = new Benchmark.Suite();

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

function modifyObj(obj) {
  obj.firstName = 'Joachim';
  obj.lastName = 'Wester';
  obj.cars[0].speed = 123;
  obj.cars[0].temp.speed = 456;
}

function reverseString(str) {
  return str.split("").reverse().join("");
}

/* ============================= */

{
  const suiteName = 'Observe and generate, small object';
  
  if (includeComparisons) {
    suite.add(`${suiteName} (noop)`, function() {
      const obj = generateBigObjectFixture(1);
      modifyObj(obj);
    });
  }

  {
    suite.add(`${suiteName} (JSONPatcherProxy)`, function() {
      const obj = generateBigObjectFixture(1);
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);
      modifyObj(observedObj);
      jsonPatcherProxy.generate();
    });
  }
  
  if (includeComparisons) {
    suite.add(`${suiteName} (fast-json-patch)`, function() {
      const obj = generateBigObjectFixture(1);
      const observer = jsonpatch.observe(obj);
      modifyObj(obj);
      jsonpatch.generate(observer);
    });
  }
}

/* ============================= */

{
  const suiteName = 'Observe and generate';
  
  if (includeComparisons) {
    suite.add(`${suiteName} (noop)`, function() {
      const obj = generateBigObjectFixture(100);
      modifyObj(obj);
    });
  }

  {
    suite.add(`${suiteName} (JSONPatcherProxy)`, function() {
      const obj = generateBigObjectFixture(100);
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);
      modifyObj(observedObj);
      jsonPatcherProxy.generate();
    });
  }
  
  if (includeComparisons) {
    suite.add(`${suiteName} (fast-json-patch)`, function() {
      const obj = generateBigObjectFixture(100);
      const observer = jsonpatch.observe(obj);
      modifyObj(obj);
      jsonpatch.generate(observer);
    });
  }
}

/* ============================= */

{
  const suiteName = 'Primitive mutation';

  if (includeComparisons) {
    const obj = generateBigObjectFixture(100);
    
    suite.add(`${suiteName} (noop)`, function() {
      obj.cars[50].name = reverseString(obj.cars[50].name);
    });
  }

  {
    const obj = generateBigObjectFixture(100);
    const jsonPatcherProxy = new JSONPatcherProxy(obj);
    const observedObj = jsonPatcherProxy.observe(true);
    
    suite.add(`${suiteName} (JSONPatcherProxy)`, function() {
      observedObj.cars[50].name = reverseString(observedObj.cars[50].name);
      jsonPatcherProxy.generate();
    });
  }

  if (includeComparisons) {
    const obj = generateBigObjectFixture(100);
    const observer = jsonpatch.observe(obj);
    
    suite.add(`${suiteName} (fast-json-patch)`, function() {
      obj.cars[50].name = reverseString(obj.cars[50].name);
      jsonpatch.generate(observer);
    });
  }
}

/* ============================= */

{
  const suiteName = 'Complex mutation';

  if (includeComparisons) {
    const obj = generateBigObjectFixture(100);
  
    suite.add(`${suiteName} (noop)`, function() {
      const item = obj.cars.shift();
      obj.cars.push(item);
    });
  }

  {
    const obj = generateBigObjectFixture(100);
    const jsonPatcherProxy = new JSONPatcherProxy(obj);
    const observedObj = jsonPatcherProxy.observe(true);
  
    suite.add(`${suiteName} (JSONPatcherProxy)`, function() {
      const item = observedObj.cars.shift();
      observedObj.cars.push(item);
      jsonPatcherProxy.generate();
    });
  }

  if (includeComparisons) {
    const obj = generateBigObjectFixture(100);
    const observer = jsonpatch.observe(obj);
  
    suite.add(`${suiteName} (fast-json-patch)`, function() {
      const item = obj.cars.shift();
      obj.cars.push(item);
      jsonpatch.generate(observer);
    });
  }
}

/* ============================= */

{
  const suiteName = 'Serialization';

  if (includeComparisons) {
    const obj = generateBigObjectFixture(100);
  
    suite.add(`${suiteName} (noop)`, function() {
      JSON.stringify(obj);
    });
  }

  {
    const obj = generateBigObjectFixture(100);
    const jsonPatcherProxy = new JSONPatcherProxy(obj);
    const observedObj = jsonPatcherProxy.observe(true);
  
    suite.add(`${suiteName} (JSONPatcherProxy)`, function() {
      JSON.stringify(observedObj);
    });
  }

  if (includeComparisons) {
    const obj = generateBigObjectFixture(100);
    const observer = jsonpatch.observe(obj);
  
    suite.add(`${suiteName} (fast-json-patch)`, function() {
      JSON.stringify(obj);
    });
  }
}

/* ============================= */

// if we are in the browser with benchmark < 2.1.2
if (typeof benchmarkReporter !== 'undefined') {
  benchmarkReporter(suite);
} else {
  suite.on('complete', function() {
    benchmarkResultsToConsole(suite);
  });
  suite.run();
}