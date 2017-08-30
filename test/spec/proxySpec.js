if (typeof jsonpatch === 'undefined') {
  jsonpatch = require('fast-json-patch');
}
if (typeof JSONPatcherProxy === 'undefined') {
  JSONPatcherProxy = require('../../src/jsonpatcherproxy');
}

if (typeof _ === 'undefined') {
  var _ = require('lodash');
}

function getPatchesUsingGenerate(objFactory, objChanger) {
  var obj = objFactory();
  var jsonPatcherProxy = new JSONPatcherProxy(obj);
  var observedObj = jsonPatcherProxy.observe();
  objChanger(observedObj);
  return jsonPatcherProxy.generate();
}

function getPatchesUsingCompare(objFactory, objChanger) {
  var obj = objFactory();
  var mirror = JSON.parse(JSON.stringify(obj));
  objChanger(obj);
  return jsonpatch.compare(mirror, JSON.parse(JSON.stringify(obj)));
}

var customMatchers = {
  /**
     * This matcher is only needed in Chrome 28 (Chrome 28 cannot successfully compare observed objects immediately after they have been changed. Chrome 30 is unaffected)
     * @param obj
     * @returns {boolean}
     */
  toEqualInJson: function(util, customEqualityTesters) {
    return {
      compare: function(actual, expected) {
        return {
          pass: JSON.stringify(actual) == JSON.stringify(expected)
        };
      }
    };
  },
  toReallyEqual: function(util, customEqualityTesters) {
    return {
      compare: function(actual, expected) {
        return {
          pass: _.isEqual(actual, expected)
        };
      }
    };
  }
};
describe('Custom matchers', function() {
  beforeEach(function() {
    jasmine.addMatchers(customMatchers);
  });

  describe('toReallyEqual', function() {
    it('should treat deleted, undefined and null values as different', function() {
      expect({
        a: undefined
      }).not.toReallyEqual({});
      expect({
        a: null
      }).not.toReallyEqual({});
      expect({}).not.toReallyEqual({
        a: undefined
      });
      expect({}).not.toReallyEqual({
        a: null
      });
      expect({
        a: undefined
      }).not.toReallyEqual({
        a: null
      });
      expect({
        a: null
      }).not.toReallyEqual({
        a: undefined
      });
    });
  });
});
describe('proxy', function() {
  beforeEach(function() {
    jasmine.addMatchers(customMatchers);
  });

  describe('generate', function() {
    it('should generate replace', function() {
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
      var observedObj = jsonPatcherProxy.observe();

      observedObj.firstName = 'Joachim';
      observedObj.lastName = 'Wester';
      observedObj.phoneNumbers[0].number = '123';
      observedObj.phoneNumbers[1].number = '456';

      var patches = jsonPatcherProxy.generate();

      var obj2 = {
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
      jsonpatch.applyPatch(obj2, patches);

      /* iOS and Android */
      observedObj = JSONPatcherProxy.deepClone(observedObj);

      expect(obj2).toReallyEqual(observedObj);
    });
    it('should generate replace (escaped chars)', function() {
      var obj = {
        '/name/first': 'Albert',
        '/name/last': 'Einstein',
        '~phone~/numbers': [
          {
            number: '12345'
          },
          {
            number: '45353'
          }
        ]
      };
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      observedObj['/name/first'] = 'Joachim';
      observedObj['/name/last'] = 'Wester';
      observedObj['~phone~/numbers'][0].number = '123';
      observedObj['~phone~/numbers'][1].number = '456';

      var patches = jsonPatcherProxy.generate();
      var obj2 = {
        '/name/first': 'Albert',
        '/name/last': 'Einstein',
        '~phone~/numbers': [
          {
            number: '12345'
          },
          {
            number: '45353'
          }
        ]
      };

      jsonpatch.applyPatch(obj2, patches);

      /* iOS and Android */
      observedObj = JSONPatcherProxy.deepClone(observedObj);

      expect(obj2).toReallyEqual(observedObj);
    });

    it('should generate replace (2 observers)', function() {
      var person1 = {
        firstName: 'Alexandra',
        lastName: 'Galbreath'
      };
      var person2 = {
        firstName: 'Lisa',
        lastName: 'Mendoza'
      };

      var jsonPatcherProxy1 = new JSONPatcherProxy(person1);
      var observedPerson1 = jsonPatcherProxy1.observe(true);

      var jsonPatcherProxy2 = new JSONPatcherProxy(person2);
      var observedPerson2 = jsonPatcherProxy2.observe(true);

      observedPerson1.firstName = 'Alexander';
      observedPerson2.firstName = 'Lucas';

      var patch1 = jsonPatcherProxy1.generate();
      var patch2 = jsonPatcherProxy2.generate();

      expect(patch1).toReallyEqual([
        {
          op: 'replace',
          path: '/firstName',
          value: 'Alexander'
        }
      ]);
      expect(patch2).toReallyEqual([
        {
          op: 'replace',
          path: '/firstName',
          value: 'Lucas'
        }
      ]);
    });

    it('should generate replace (double change, shallow object)', function() {
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
      var observedObj = jsonPatcherProxy.observe();

      observedObj.firstName = 'Marcin';

      var patches = jsonPatcherProxy.generate();

      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/firstName',
          value: 'Marcin'
        }
      ]);

      observedObj.lastName = 'Warp';
      patches = jsonPatcherProxy.generate(); //first patch should NOT be reported again here
      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/lastName',
          value: 'Warp'
        }
      ]);

      /* iOS and Android */
      observedObj = JSONPatcherProxy.deepClone(observedObj);

      expect(observedObj).toReallyEqual({
        firstName: 'Marcin',
        lastName: 'Warp',
        phoneNumbers: [
          {
            number: '12345'
          },
          {
            number: '45353'
          }
        ]
      }); //objects should be still the same
    });

    it('should generate replace (double change, deep object)', function() {
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
      var observedObj = jsonPatcherProxy.observe();

      observedObj.phoneNumbers[0].number = '123';

      var patches = jsonPatcherProxy.generate();

      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/0/number',
          value: '123'
        }
      ]);

      observedObj.phoneNumbers[1].number = '456';
      patches = jsonPatcherProxy.generate(); //first patch should NOT be reported again here
      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/1/number',
          value: '456'
        }
      ]);

      /* iOS and Android */
      observedObj = JSONPatcherProxy.deepClone(observedObj);

      expect(observedObj).toReallyEqual({
        firstName: 'Albert',
        lastName: 'Einstein',
        phoneNumbers: [
          {
            number: '123'
          },
          {
            number: '456'
          }
        ]
      }); //objects should be still the same
    });

    it('should generate replace (changes in new array cell, primitive values)', function() {
      var arr = [1];

      var jsonPatcherProxy = new JSONPatcherProxy(arr);
      var observedArr = jsonPatcherProxy.observe();

      observedArr.push(2);

      var patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([
        {
          op: 'add',
          path: '/1',
          value: 2
        }
      ]);

      observedArr[0] = 3;

      patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/0',
          value: 3
        }
      ]);

      observedArr[1] = 4;

      patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/1',
          value: 4
        }
      ]);
    });
    it('should generate replace (changes in new array cell, complex values)', function() {
      var arr = [
        {
          id: 1,
          name: 'Ted'
        }
      ];

      var jsonPatcherProxy = new JSONPatcherProxy(arr);
      var observedArr = jsonPatcherProxy.observe();

      observedArr.push({
        id: 2,
        name: 'Jerry'
      });

      var patches = jsonPatcherProxy.generate();

      /* iOS and Android */
      patches = JSONPatcherProxy.deepClone(patches);

      expect(patches).toReallyEqual([
        {
          op: 'add',
          path: '/1',
          value: {
            id: 2,
            name: 'Jerry'
          }
        }
      ]);

      observedArr[0].id = 3;

      patches = jsonPatcherProxy.generate();

      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/0/id',
          value: 3
        }
      ]);

      observedArr[1].id = 4;

      patches = jsonPatcherProxy.generate();

      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/1/id',
          value: 4
        }
      ]);
    });
    it('should generate add', function() {
      var obj = {
        lastName: 'Einstein',
        phoneNumbers: [
          {
            number: '12345'
          }
        ]
      };
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      observedObj.firstName = 'Joachim';
      observedObj.lastName = 'Wester';
      observedObj.phoneNumbers[0].number = '123';
      observedObj.phoneNumbers.push({
        number: '456'
      });
      var patches = jsonPatcherProxy.generate();

      var obj2 = {
        lastName: 'Einstein',
        phoneNumbers: [
          {
            number: '12345'
          }
        ]
      };

      jsonpatch.applyPatch(obj2, patches);
      expect(obj2).toEqualInJson(observedObj);
    });
    it('should generate remove', function() {
      var obj = {
        lastName: 'Einstein',
        firstName: 'Albert',
        phoneNumbers: [
          {
            number: '12345'
          },
          {
            number: '4234'
          }
        ]
      };
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      delete observedObj.firstName;
      observedObj.lastName = 'Wester';
      observedObj.phoneNumbers[0].number = '123';
      observedObj.phoneNumbers.pop(1);

      var patches = jsonPatcherProxy.generate();
      var obj2 = {
        lastName: 'Einstein',
        firstName: 'Albert',
        phoneNumbers: [
          {
            number: '12345'
          },
          {
            number: '4234'
          }
        ]
      };
      jsonpatch.applyPatch(obj2, patches);
      expect(obj2).toEqualInJson(observedObj);
    });
    it('should generate remove and disable all traps', function() {
      var obj = {
        lastName: 'Einstein',
        firstName: 'Albert',
        phoneNumbers: [
          {
            number: '12345'
          },
          {
            number: '4234'
          }
        ]
      };
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      var cachedPhoneNumber = observedObj.phoneNumbers[1];
      delete observedObj.phoneNumbers[1];

      var patches = jsonPatcherProxy.generate();

      expect(patches.length).toEqual(1); // remove patch

      /* modify child object */
      cachedPhoneNumber.number = 123421;

      var patches = jsonPatcherProxy.generate();

      /* Should be zero */
      expect(patches.length).toEqual(0);
    });

    it('should generate remove (array indexes should be sorted descending)', function() {
      var obj = {
        items: ['a', 'b', 'c']
      };
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      observedObj.items.pop();
      observedObj.items.pop();

      var patches = jsonPatcherProxy.generate();

      //array indexes must be sorted descending, otherwise there is an index collision in apply
      expect(patches).toReallyEqual([
        {
          op: 'remove',
          path: '/items/2'
        },
        {
          op: 'remove',
          path: '/items/1'
        }
      ]);

      var obj2 = {
        items: ['a', 'b', 'c']
      };
      jsonpatch.applyPatch(obj2, patches);
      expect(observedObj).toEqualInJson(obj2);
    });

    it('should not generate the same patch twice (replace)', function() {
      var obj = {
        lastName: 'Einstein'
      };
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      observedObj.lastName = 'Wester';

      var patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/lastName',
          value: 'Wester'
        }
      ]);

      patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([]);
    });

    it('should not generate the same patch twice (add)', function() {
      var obj = {
        lastName: 'Einstein'
      };
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      observedObj.firstName = 'Albert';

      var patches = jsonPatcherProxy.generate();

      expect(patches).toReallyEqual([
        {
          op: 'add',
          path: '/firstName',
          value: 'Albert'
        }
      ]);

      patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([]);
    });

    it('should not generate the same patch twice (remove)', function() {
      var obj = {
        lastName: 'Einstein'
      };
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      delete observedObj.lastName;

      var patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([
        {
          op: 'remove',
          path: '/lastName'
        }
      ]);

      patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([]);
    });

    it('should ignore array properties', function() {
      var obj = {
        array: [1, 2, 3]
      };

      var patches;

      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe();

      observedObj.array.value = 1;
      patches = jsonPatcherProxy.generate();
      expect(patches.length).toReallyEqual(0);

      observedObj.array.value = 2;
      patches = jsonPatcherProxy.generate();
      expect(patches.length).toReallyEqual(0);
    });

    describe('undefined - JS to JSON projection', function() {
      it('when value is set to `undefined`, should generate remove (undefined is JSON.stringified to no value)', function() {
        var obj = {
          foo: 'bar'
        };

        var jsonPatcherProxy = new JSONPatcherProxy(obj);
        var observedObj = jsonPatcherProxy.observe();
        observedObj.foo = undefined;

        var patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([
          {
            op: 'remove',
            path: '/foo'
          }
        ]);
      });

      it('when new property is added, and set to `undefined`, nothing should be generated (undefined is JSON.stringified to no value)', function() {
        var obj = {
          foo: 'bar'
        };

        var jsonPatcherProxy = new JSONPatcherProxy(obj);
        var observedObj = jsonPatcherProxy.observe();
        observedObj.baz = undefined;

        var patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([]);
      });

      it('when array element is set to `undefined`, should generate replace to `null` (undefined array elements are JSON.stringified to `null`)', function() {
        var obj = {
          foo: [0, 1, 2]
        };

        var jsonPatcherProxy = new JSONPatcherProxy(obj);
        var observedObj = jsonPatcherProxy.observe();
        observedObj.foo[1] = undefined;

        var patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([
          {
            op: 'replace',
            path: '/foo/1',
            value: null
          }
        ]);
      });

      it('when `undefined` property is set to something, should generate add (undefined in JSON.stringified to no value)', function() {
        var obj = {
          foo: undefined
        };

        var jsonPatcherProxy = new JSONPatcherProxy(obj);
        var observedObj = jsonPatcherProxy.observe();
        observedObj.foo = 'something';

        var patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([
          {
            op: 'add',
            path: '/foo',
            value: 'something'
          }
        ]);
      });
      it('when `undefined` array element is set to something, should generate replace (undefined array elements are JSON.stringified to `null`)', function() {
        var obj = {
          foo: [0, undefined, 2]
        };

        var jsonPatcherProxy = new JSONPatcherProxy(obj);
        var observedObj = jsonPatcherProxy.observe();
        observedObj.foo[1] = 1;

        var patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([
          {
            op: 'replace',
            path: '/foo/1',
            value: 1
          }
        ]);
      });
    });

    describe('undefined - JSON to JS extension', function() {
      describe('should generate empty patch, when', function() {
        it('when new property is set to `undefined`', function() {
          var objFactory = function() {
            return {
              foo: 'bar'
            };
          };

          var objChanger = function(obj) {
            obj.baz = undefined;
          };

          var genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          var comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

          expect(genereatedPatches).toReallyEqual([]);
          expect(genereatedPatches).toReallyEqual(comparedPatches);
        });

        it('when an `undefined` property is deleted', function() {
          var objFactory = function() {
            return {
              foo: undefined
            };
          };

          var objChanger = function(obj) {
            delete obj.foo;
          };

          var genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          var comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

          expect(genereatedPatches).toReallyEqual([]);
          expect(genereatedPatches).toReallyEqual(comparedPatches);
        });
      });

      describe('should generate add, when', function() {
        it('`undefined` property is set to something', function() {
          var objFactory = function() {
            return {
              foo: undefined
            };
          };

          var objChanger = function(obj) {
            obj.foo = 'something';
          };

          var genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          var comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

          expect(genereatedPatches).toReallyEqual([
            {
              op: 'add',
              path: '/foo',
              value: 'something'
            }
          ]);
          expect(genereatedPatches).toReallyEqual(comparedPatches);
        });
      });

      describe('should generate remove, when', function() {
        it('value is set to `undefined`', function() {
          var objFactory = function() {
            return {
              foo: 'bar'
            };
          };

          var objChanger = function(obj) {
            obj.foo = undefined;
          };

          var genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          var comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

          expect(genereatedPatches).toReallyEqual([
            {
              op: 'remove',
              path: '/foo'
            }
          ]);
          expect(genereatedPatches).toReallyEqual(comparedPatches);
        });
      });

      describe('should generate replace, when', function() {
        it('array element is set to `undefined`', function() {
          var objFactory = function() {
            return {
              foo: [0, 1, 2]
            };
          };

          var objChanger = function(obj) {
            obj.foo[1] = undefined;
          };

          var genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          var comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

          expect(genereatedPatches).toReallyEqual([
            {
              op: 'replace',
              path: '/foo/1',
              value: null
            }
          ]);
          expect(genereatedPatches).toReallyEqual(comparedPatches);
        });
        it('`undefined` array element is set to something', function() {
          var objFactory = function() {
            return {
              foo: [0, undefined, 2]
            };
          };

          var objChanger = function(obj) {
            obj.foo[1] = 1;
          };

          var genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          var comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

          expect(genereatedPatches).toReallyEqual([
            {
              op: 'replace',
              path: '/foo/1',
              value: 1
            }
          ]);
          expect(genereatedPatches).toReallyEqual(comparedPatches);
        });
      });
    });
  });

  describe('apply', function() {
    // https://tools.ietf.org/html/rfc6902#appendix-A.16
    it('should add an Array Value', function() {
      var obj = {
        foo: ['bar']
      };
      var patches = [
        {
          op: 'add',
          path: '/foo/-',
          value: ['abc', 'def']
        }
      ];

      jsonpatch.applyPatch(obj, patches);
      expect(obj).toReallyEqual({
        foo: ['bar', ['abc', 'def']]
      });
    });
  });

  describe('callback', function() {
    it('should generate replace', function(done) {
      var obj2;
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

      function patchesChanged(patch) {
        obj2 = {
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
        jsonpatch.applyPatch(obj2, patch);

        /* iOS and Android */
        observedObj = JSONPatcherProxy.deepClone(observedObj);
        expect(obj2).toReallyEqual(observedObj);
      };

      patchesChanged = patchesChanged.bind(this);

      var observedObj = jsonPatcherProxy.observe(function(patch) {
        patchesChanged(patch);
      });

      observedObj.firstName = 'Joachim';
      jsonPatcherProxy.touch();
      done();
    });

    it('should generate replace (double change, shallow object)', function() {
      var lastPatches,
        called = 0;

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


      // ugly migration from Jasmine 1.x to > 2.0
      function patchesChanged(time) {
        switch (time) {
          case 1:
            expect(called).toReallyEqual(1);
            expect(lastPatches).toReallyEqual([
              {
                op: 'replace',
                path: '/firstName',
                value: 'Marcin'
              }
            ]);

            obj.lastName = 'Warp';
            break;
          case 2:
            expect(called).toReallyEqual(2);
            expect(lastPatches).toReallyEqual([
              {
                op: 'replace',
                path: '/lastName',
                value: 'Warp'
              }
            ]); //first patch should NOT be reported again here

            expect(obj).toReallyEqual({
              firstName: 'Marcin',
              lastName: 'Warp',
              phoneNumbers: [
                {
                  number: '12345'
                },
                {
                  number: '45353'
                }
              ]
            }); //objects should be still the same
            break;
        }
      }
      patchesChanged.bind(this);

      var observedObj = jsonPatcherProxy.observe(function(patches) {
        called++;
        lastPatches = patches;
        patchesChanged(called);
      });
      observedObj.firstName = 'Marcin';   
      jsonPatcherProxy.touch();   
    });

    it('should generate replace (double change, deep object)', function() {
      var lastPatches,
        called = 0;

      // ugly migration from Jasmine 1.x to > 2.0
      function patchesChanged(time) {
        switch (time) {
          case 1:
            expect(called).toReallyEqual(1);
            expect(lastPatches).toReallyEqual([
              {
                op: 'replace',
                path: '/phoneNumbers/0/number',
                value: '123'
              }
            ]);

            obj.phoneNumbers[1].number = '456';
            break;
          case 2:
            expect(called).toReallyEqual(2);
            expect(lastPatches).toReallyEqual([
              {
                op: 'replace',
                path: '/phoneNumbers/1/number',
                value: '456'
              }
            ]); //first patch should NOT be reported again here

            expect(obj).toReallyEqual({
              firstName: 'Albert',
              lastName: 'Einstein',
              phoneNumbers: [
                {
                  number: '123'
                },
                {
                  number: '456'
                }
              ]
            }); //objects should be still the same
            break;
        }
      }
      patchesChanged.bind(this);

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

      var observedObj = jsonPatcherProxy.observe(function(patches) {
        called++;
        lastPatches = patches;
        patchesChanged(called);
      });
      observedObj.phoneNumbers[0].number = '123';
      jsonPatcherProxy.touch();
    });

    it('Calling `touch` should execute callback synchronously', function() {
      var lastPatches,
        called = 0,
        res;

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
      var observedObj = jsonPatcherProxy.observe(function(patches) {
        called++;
        lastPatches = patches;
      });
      observedObj.phoneNumbers[0].number = '123';

      jsonPatcherProxy.touch();

      expect(called).toReallyEqual(1);
      expect(lastPatches).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/0/number',
          value: '123'
        }
      ]);
    });
  });
  describe('Already proxified values', function() {
    it("shouldn't re-proxify (it should deep clone) proxified values from different instances", function() {
      var obj = {
        one: [1, 2, 3, 4, 5],
        two: [6, 7, 6, 5, 4]
      };

      var countOne = 0;
      var instance1 = new JSONPatcherProxy(obj);
      var observedObjOne = instance1.observe(function() {
        countOne++;
      });

      var countTwo = 0;
      var instance2 = new JSONPatcherProxy(obj);
      var observedObjTwo = instance2.observe(function() {
        countTwo++;
      });

      //control test, to make sure tests are correct
      expect(countOne).toReallyEqual(0);

      observedObjOne.one[0] = 100;

      instance1.touch();

      expect(countOne).toReallyEqual(1);

      // isolate the proxified array
      var observedArray = observedObjOne.one;

      // change the proxified array
      observedArray[1] = 200;

      instance1.touch();

      // expect a patch
      expect(countOne).toReallyEqual(2);

      instance2.touch();

      // make sure second observer never went off
      expect(countTwo).toReallyEqual(0);

      // add an already proxified array
      observedObjTwo.three = observedArray;

      instance2.touch();

      // expect a patch from second observer (add /three)
      expect(countTwo).toReallyEqual(1);

      //change the array in second observer
      observedObjTwo.three[2] = 100;

      instance2.touch();

      // expect a patch from second observer (replace /three/2/)
      expect(countTwo).toReallyEqual(2);

      instance1.touch();

      // first observer should NOT emit a patch
      expect(countOne).toReallyEqual(2);
    });
    it('Shifting an array should refresh path correctly', function() {
      var obj = {
        arr: [{ name: 'omar' }, { name: 'ali' }]
      };

      const spy = jasmine.createSpy('spy');

      var instance = new JSONPatcherProxy(obj);

      var observedObj = instance.observe(spy);

      observedObj.arr.shift();

      instance.touch();

      expect(spy.calls.count()).toEqual(1);

      //is it shifted?
      expect(observedObj.arr[0].name).toEqual('ali');

      // is newly-moved first items aware of its new path?
      observedObj.arr[0].name = 'steve';

      instance.touch();

      // should be called one more time
      expect(spy.calls.count()).toEqual(2);

      var args = spy.calls.mostRecent().args[0];

      expect(args).toEqual([
        { op: 'replace', path: '/arr/0/name', value: 'steve' }
      ]);
    });
    it('Moving an element in the array should change its path', function() {
      var obj = {
        arrayOfArrays: [[{ item1: 'item1' }], [{ item2: 'item2' }]]
      };

      const spy = jasmine.createSpy('spy');
      var instance = new JSONPatcherProxy(obj);
      var observedObj = instance.observe(spy);
      const item2reference = observedObj.arrayOfArrays[1][0];
      item2reference.item2 = 'item2 modified';

      //bump async
      instance.touch();

      // control call, nothing important
      var args = spy.calls.mostRecent().args[0];

      // path is /arrayOfArrays/1/0/item2
      expect(args).toEqual([
        {
          op: 'replace',
          path: '/arrayOfArrays/1/0/item2',
          value: 'item2 modified'
        }
      ]);

      //remove first array element
      observedObj.arrayOfArrays.shift();

      //bump async
      instance.touch();

      item2reference.item2 = 'item2 modified again';

      //bump async
      instance.touch();

      args = spy.calls.mostRecent().args[0];

      //now item2reference.item2  path should change to "/arrayOfArrays/0/0/item2"
      expect(args).toEqual([
        {
          op: 'replace',
          path: '/arrayOfArrays/0/0/item2',
          value: 'item2 modified again'
        }
      ]);
    });
  });

  describe('stopping observing', function() {
    it("shouldn't emit patches after calling `disableTraps`", function() {
      var obj = {
        foo: 'bar'
      };

      var count = 0;
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe(function() {
        count++;
      });

      observedObj.foo = 'koko';

      jsonPatcherProxy.touch();

      expect(count).toReallyEqual(1);

      jsonPatcherProxy.disableTraps();

      observedObj.foo = 'momo';

      observedObj.foo = 'lolo';

      expect(count).toReallyEqual(1);
    });
    it('should throw a warning if object is modified after `disableTraps`', function() {
      var obj = {
        foo: 'bar'
      };

      var count = 0;
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe(function() {
        count++;
      });

      spyOn(console, 'warn');

      observedObj.foo = 'koko';

      jsonPatcherProxy.touch();

      expect(count).toReallyEqual(1);

      jsonPatcherProxy.disableTraps();

      observedObj.foo = 'momo';

      expect(count).toReallyEqual(1);
      expect(console.warn).toHaveBeenCalled();
    });
    it('should throw a warning if object is modified after detached', function() {
      var obj = { child: { name: 'omar' } };

      var count = 0;
      var jsonPatcherProxy = new JSONPatcherProxy(obj, true);
      var observedObj = jsonPatcherProxy.observe(function() {
        count++;
      });

      spyOn(console, 'warn');

      observedObj.child.name = 'Tomek';

      jsonPatcherProxy.touch();

      // change should emit a patch
      expect(count).toReallyEqual(1);

      //cache a sub-object
      const childObjectCached = observedObj.child;

      //detach it
      delete observedObj.child;

      jsonPatcherProxy.touch();

      // deletion patch
      expect(count).toReallyEqual(2);

      childObjectCached.name = 'Marcin';

      // shouldn't emit a patch
      expect(count).toReallyEqual(2);

      // but should warn about it
      expect(console.warn).toHaveBeenCalled();
    });
    it('should throw an error if object is modified after revoked', function() {
      var obj = { child: { name: 'omar' } };

      var count = 0;
      var jsonPatcherProxy = new JSONPatcherProxy(obj, true);
      var observedObj = jsonPatcherProxy.observe(function() {
        count++;
      });

      observedObj.child.name = 'Tomek';

      jsonPatcherProxy.touch();

      // change should emit a patch
      expect(count).toReallyEqual(1);

      //cache a sub-object
      const childObjectCached = observedObj.child;

      //detach it
      delete observedObj.child;

      //revoke the instance
      jsonPatcherProxy.revoke();

      // modifying root should throw
      expect(() => (observedObj.add = 'added')).toThrow();
    });
  });

  describe('pausing and resuming', function() {
    it("shouldn't emit patches when paused", function() {
      var called = 0;

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
      var observedObj = jsonPatcherProxy.observe(function(patches) {
        called++;
      });

      observedObj.firstName = 'Malvin';

      jsonPatcherProxy.touch();

      expect(called).toReallyEqual(1);

      observedObj.firstName = 'Ronaldo';

      jsonPatcherProxy.touch();

      expect(called).toReallyEqual(2);

      jsonPatcherProxy.pause();

      observedObj.firstName = 'Messi';

      expect(called).toReallyEqual(2);
    });

    it('Should re-start emitting patches when paused then resumed', function() {
      var called = 0;

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
      var observedObj = jsonPatcherProxy.observe(function(patches) {
        called++;
      });

      observedObj.firstName = 'Malvin';

      jsonPatcherProxy.touch();

      expect(called).toReallyEqual(1);

      observedObj.firstName = 'Ronaldo';

      jsonPatcherProxy.touch();

      expect(called).toReallyEqual(2);

      jsonPatcherProxy.pause();

      observedObj.firstName = 'Messi';
      expect(called).toReallyEqual(2);

      jsonPatcherProxy.resume();

      observedObj.firstName = 'Carlos';

      jsonPatcherProxy.touch();

      expect(called).toReallyEqual(3);
    });
    it('should handle callbacks that call resume() and pause() internally', function() {
      var obj = {
        foo: 'bar'
      };

      var count = 0;
      var jsonPatcherProxy = new JSONPatcherProxy(obj);
      var observedObj = jsonPatcherProxy.observe(function() {
        count++;
        jsonPatcherProxy.pause();
      });

      observedObj.foo = 'koko';

      jsonPatcherProxy.touch();

      // should emit once and then stop emitting

      observedObj.foo = 'momo';

      observedObj.foo = 'lolo';

      jsonPatcherProxy.touch();

      expect(count).toReallyEqual(1);

      jsonPatcherProxy.resume();

      //Should emit again
      observedObj.foo = 'fofo';

      jsonPatcherProxy.touch();

      expect(count).toReallyEqual(2);
    });
  });
});
