if (typeof jsonpatch === 'undefined') {
  global.jsonpatch = require('fast-json-patch');
}
if (typeof JSONPatcherProxy === 'undefined') {
  global.JSONPatcherProxy = require('../../src/jsonpatcherproxy');
}

if (typeof _ === 'undefined') {
  global._ = require('lodash');
}

function getPatchesUsingGenerate(objFactory, objChanger) {
  const obj = objFactory();
  const jsonPatcherProxy = new JSONPatcherProxy(obj);
  const observedObj = jsonPatcherProxy.observe(true);
  objChanger(observedObj);
  return jsonPatcherProxy.generate();
}

function getPatchesUsingCompare(objFactory, objChanger) {
  const obj = objFactory();
  const mirror = JSON.parse(JSON.stringify(obj));
  objChanger(obj);
  return jsonpatch.compare(mirror, JSON.parse(JSON.stringify(obj)));
}

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

const customMatchers = {
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
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.firstName = 'Joachim';
      observedObj.lastName = 'Wester';

      observedObj.phoneNumbers[0].number = '123';
      observedObj.phoneNumbers[1].number = '456';

      const patches = jsonPatcherProxy.generate();

      const obj2 = generateDeepObjectFixture();
      jsonpatch.applyPatch(obj2, patches);

      /* iOS and Android */
      const observedObj2 = JSONPatcherProxy.deepClone(observedObj);
      expect(obj2).toReallyEqual(observedObj2);
    });
    it('should generate replace (escaped chars)', function() {
      const obj = {
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
      const obj2 = JSON.parse(JSON.stringify(obj));
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj['/name/first'] = 'Joachim';
      observedObj['/name/last'] = 'Wester';
      observedObj['~phone~/numbers'][0].number = '123';
      observedObj['~phone~/numbers'][1].number = '456';

      const patches = jsonPatcherProxy.generate();
      jsonpatch.applyPatch(obj2, patches);

      /* iOS and Android */
      const observedObj2 = JSONPatcherProxy.deepClone(observedObj);
      expect(obj2).toReallyEqual(observedObj2);
    });

    it('should generate replace (2 observers)', function() {
      const person1 = {
        firstName: 'Alexandra',
        lastName: 'Galbreath'
      };
      const person2 = {
        firstName: 'Lisa',
        lastName: 'Mendoza'
      };

      const jsonPatcherProxy1 = new JSONPatcherProxy(person1);
      const observedPerson1 = jsonPatcherProxy1.observe(true);

      const jsonPatcherProxy2 = new JSONPatcherProxy(person2);
      const observedPerson2 = jsonPatcherProxy2.observe(true);

      observedPerson1.firstName = 'Alexander';
      observedPerson2.firstName = 'Lucas';

      const patch1 = jsonPatcherProxy1.generate();
      const patch2 = jsonPatcherProxy2.generate();

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
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.firstName = 'Marcin';

      const patches = jsonPatcherProxy.generate();

      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/firstName',
          value: 'Marcin'
        }
      ]);

      observedObj.lastName = 'Warp';
      const patches2 = jsonPatcherProxy.generate(); //first patch should NOT be reported again here
      expect(patches2).toReallyEqual([
        {
          op: 'replace',
          path: '/lastName',
          value: 'Warp'
        }
      ]);

      /* iOS and Android */
      const observedObj2 = JSONPatcherProxy.deepClone(observedObj);

      expect(observedObj2).toReallyEqual({
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
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.phoneNumbers[0].number = '123';

      const patches = jsonPatcherProxy.generate();

      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/0/number',
          value: '123'
        }
      ]);

      observedObj.phoneNumbers[1].number = '456';
      const patches2 = jsonPatcherProxy.generate(); //first patch should NOT be reported again here
      expect(patches2).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/1/number',
          value: '456'
        }
      ]);

      /* iOS and Android */
      const observedObj2 = JSONPatcherProxy.deepClone(observedObj);

      const obj2 = generateDeepObjectFixture();
      obj2.phoneNumbers[0].number = '123';
      obj2.phoneNumbers[1].number = '456';
      expect(observedObj2).toReallyEqual(obj2); //objects should be still the same
    });

    it('should generate replace (changes in new array cell, primitive values)', function() {
      const arr = [1];

      const jsonPatcherProxy = new JSONPatcherProxy(arr);
      const observedArr = jsonPatcherProxy.observe(true);

      observedArr.push(2);

      const patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([
        {
          op: 'add',
          path: '/1',
          value: 2
        }
      ]);

      observedArr[0] = 3;

      const patches2 = jsonPatcherProxy.generate();
      expect(patches2).toReallyEqual([
        {
          op: 'replace',
          path: '/0',
          value: 3
        }
      ]);

      observedArr[1] = 4;

      const patches3 = jsonPatcherProxy.generate();
      expect(patches3).toReallyEqual([
        {
          op: 'replace',
          path: '/1',
          value: 4
        }
      ]);
    });
    it('should generate replace (changes in new array cell, complex values)', function() {
      const arr = [
        {
          id: 1,
          name: 'Ted'
        }
      ];

      const jsonPatcherProxy = new JSONPatcherProxy(arr);
      const observedArr = jsonPatcherProxy.observe(true);

      observedArr.push({
        id: 2,
        name: 'Jerry'
      });

      let patches = jsonPatcherProxy.generate();

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
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.firstName = 'Joachim';
      observedObj.lastName = 'Wester';
      observedObj.phoneNumbers[0].number = '123';
      observedObj.phoneNumbers.push({
        number: '456'
      });
      const patches = jsonPatcherProxy.generate();

      const obj2 = generateDeepObjectFixture();
      jsonpatch.applyPatch(obj2, patches);
      expect(obj2).toEqualInJson(observedObj);
    });
    it('should generate remove', function() {
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      delete observedObj.firstName;
      observedObj.lastName = 'Wester';
      observedObj.phoneNumbers[0].number = '123';
      observedObj.phoneNumbers.pop(1);

      const patches = jsonPatcherProxy.generate();

      const obj2 = generateDeepObjectFixture();
      jsonpatch.applyPatch(obj2, patches);
      expect(obj2).toEqualInJson(observedObj);
    });
    it('should generate remove and disable all traps', function() {
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      const cachedPhoneNumber = observedObj.phoneNumbers[1];
      delete observedObj.phoneNumbers[1];

      const patches = jsonPatcherProxy.generate();

      expect(patches.length).toEqual(1); // remove patch

      /* modify child object */
      cachedPhoneNumber.number = 123421;

      const patches2 = jsonPatcherProxy.generate();

      /* Should be zero */
      expect(patches2.length).toEqual(0);
    });

    it('should generate remove (array indexes should be sorted descending)', function() {
      const obj = {
        items: ['a', 'b', 'c']
      };
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.items.pop();
      observedObj.items.pop();

      const patches = jsonPatcherProxy.generate();

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

      const obj2 = {
        items: ['a', 'b', 'c']
      };
      jsonpatch.applyPatch(obj2, patches);
      expect(observedObj).toEqualInJson(obj2);
    });

    it('should not generate a patch when array props are added or replaced', function() {
      const obj = [];
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.lastName = 'Wester';

      const patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([]);

      observedObj.lastName = 'Wester Jr.';

      const patches2 = jsonPatcherProxy.generate();
      expect(patches2).toReallyEqual([]);
    });

    it('should not generate a patch when array props are added or replaced - and log a warning', function() {
      const obj = [];
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      spyOn(console, 'warn');

      observedObj.lastName = 'Wester';

      expect(console.warn).toHaveBeenCalledWith("JSONPatcherProxy noticed a non-integer property ('lastName') was set for an array. This interception will not emit a patch");
    });

    it('should not proxify an object that is assigned as an array prop - and log a warning', function() {
      const obj = [];
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      spyOn(console, 'warn');

      observedObj.person = {
        name: "Albert"
      };
      observedObj.person.name = "Joachim";

      expect(console.warn).toHaveBeenCalledWith("JSONPatcherProxy noticed a non-integer property ('person') was set for an array. This interception will not emit a patch. The value is an object, but it was not proxified, because it would not be addressable in JSON-Pointer");

      const patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([]);
    });

    it('should not generate the same patch twice (replace)', function() {
      const obj = {
        lastName: 'Einstein'
      };
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.lastName = 'Wester';

      const patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/lastName',
          value: 'Wester'
        }
      ]);

      const patches2 = jsonPatcherProxy.generate();
      expect(patches2).toReallyEqual([]);
    });

    it('should not generate the same patch twice (add)', function() {
      const obj = {
        lastName: 'Einstein'
      };
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.firstName = 'Albert';

      const patches = jsonPatcherProxy.generate();

      expect(patches).toReallyEqual([
        {
          op: 'add',
          path: '/firstName',
          value: 'Albert'
        }
      ]);

      const patches2 = jsonPatcherProxy.generate();
      expect(patches2).toReallyEqual([]);
    });

    it('should not generate the same patch twice (remove)', function() {
      const obj = {
        lastName: 'Einstein'
      };
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      delete observedObj.lastName;

      const patches = jsonPatcherProxy.generate();
      expect(patches).toReallyEqual([
        {
          op: 'remove',
          path: '/lastName'
        }
      ]);

      const patches2 = jsonPatcherProxy.generate();
      expect(patches2).toReallyEqual([]);
    });

    it('should ignore array properties', function() {
      const obj = {
        array: [1, 2, 3]
      };

      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.array.value = 1;
      const patches = jsonPatcherProxy.generate();
      expect(patches.length).toReallyEqual(0);

      observedObj.array.value = 2;
      const patches2 = jsonPatcherProxy.generate();
      expect(patches2.length).toReallyEqual(0);
    });

    describe('undefined - JS to JSON projection', function() {
      it('when value is set to `undefined`, should generate remove (undefined is JSON.stringified to no value)', function() {
        const obj = {
          foo: 'bar'
        };

        const jsonPatcherProxy = new JSONPatcherProxy(obj);
        const observedObj = jsonPatcherProxy.observe(true);
        observedObj.foo = undefined;

        const patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([
          {
            op: 'remove',
            path: '/foo'
          }
        ]);
      });

      it('when new property is added, and set to `undefined`, nothing should be generated (undefined is JSON.stringified to no value)', function() {
        const obj = {
          foo: 'bar'
        };

        const jsonPatcherProxy = new JSONPatcherProxy(obj);
        const observedObj = jsonPatcherProxy.observe(true);
        observedObj.baz = undefined;

        const patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([]);
      });

      it('when array element is set to `undefined`, should generate replace to `null` (undefined array elements are JSON.stringified to `null`)', function() {
        const obj = {
          foo: [0, 1, 2]
        };

        const jsonPatcherProxy = new JSONPatcherProxy(obj);
        const observedObj = jsonPatcherProxy.observe(true);
        observedObj.foo[1] = undefined;

        const patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([
          {
            op: 'replace',
            path: '/foo/1',
            value: null
          }
        ]);
      });

      it('when `undefined` property is set to something, should generate add (undefined in JSON.stringified to no value)', function() {
        const obj = {
          foo: undefined
        };

        const jsonPatcherProxy = new JSONPatcherProxy(obj);
        const observedObj = jsonPatcherProxy.observe(true);
        observedObj.foo = 'something';

        const patches = jsonPatcherProxy.generate();
        expect(patches).toReallyEqual([
          {
            op: 'add',
            path: '/foo',
            value: 'something'
          }
        ]);
      });
      it('when `undefined` array element is set to something, should generate replace (undefined array elements are JSON.stringified to `null`)', function() {
        const obj = {
          foo: [0, undefined, 2]
        };

        const jsonPatcherProxy = new JSONPatcherProxy(obj);
        const observedObj = jsonPatcherProxy.observe(true);
        observedObj.foo[1] = 1;

        const patches = jsonPatcherProxy.generate();
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
          const objFactory = function() {
            return {
              foo: 'bar'
            };
          };

          const objChanger = function(obj) {
            obj.baz = undefined;
          };

          const genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          const comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

          expect(genereatedPatches).toReallyEqual([]);
          expect(genereatedPatches).toReallyEqual(comparedPatches);
        });

        it('when an `undefined` property is deleted', function() {
          const objFactory = function() {
            return {
              foo: undefined
            };
          };

          const objChanger = function(obj) {
            delete obj.foo;
          };

          const genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          const comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

          expect(genereatedPatches).toReallyEqual([]);
          expect(genereatedPatches).toReallyEqual(comparedPatches);
        });
      });

      describe('should generate add, when', function() {
        it('`undefined` property is set to something', function() {
          const objFactory = function() {
            return {
              foo: undefined
            };
          };

          const objChanger = function(obj) {
            obj.foo = 'something';
          };

          const genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          const comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

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
          const objFactory = function() {
            return {
              foo: 'bar'
            };
          };

          const objChanger = function(obj) {
            obj.foo = undefined;
          };

          const genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          const comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

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
          const objFactory = function() {
            return {
              foo: [0, 1, 2]
            };
          };

          const objChanger = function(obj) {
            obj.foo[1] = undefined;
          };

          const genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          const comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

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
          const objFactory = function() {
            return {
              foo: [0, undefined, 2]
            };
          };

          const objChanger = function(obj) {
            obj.foo[1] = 1;
          };

          const genereatedPatches = getPatchesUsingGenerate(
            objFactory,
            objChanger
          );
          const comparedPatches = getPatchesUsingCompare(objFactory, objChanger);

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
      const obj = {
        foo: ['bar']
      };
      const patches = [
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
    it('should generate replace', function() {
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true);

      jsonPatcherProxy.observe(true, function(operation) {
        objChanged(operation);
      });

      observedObj.firstName = 'Joachim';

      function objChanged(operation) {
        const obj2 = generateDeepObjectFixture();
        jsonpatch.applyOperation(obj2, operation);

        /* iOS and Android */
        const observedObj2 = JSONPatcherProxy.deepClone(observedObj);

        expect(obj2).toReallyEqual(observedObj2);
      }
    });

    it('should generate replace (double change, shallow object)', function() {
      let lastPatches,
        called = 0;

      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);

      const observedObj = jsonPatcherProxy.observe(true, function(patches) {
        called++;
        lastPatches = [patches];
        patchesChanged(called);
      });
      observedObj.firstName = 'Marcin';

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
    });

    it('should generate replace (double change, deep object)', function() {
      let lastPatches,
        called = 0;

      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);

      const observedObj = jsonPatcherProxy.observe(true);

      observedObj.phoneNumbers[0].number = '123';

      patches = jsonPatcherProxy.generate();
      expect(patches.length).toReallyEqual(1);

      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/0/number',
          value: '123'
        }
      ]);

      observedObj.phoneNumbers[1].number = '456';

      patches = jsonPatcherProxy.generate();
      expect(patches.length).toReallyEqual(1);

      expect(patches).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/1/number',
          value: '456'
        }
      ]); //first patch should NOT be reported again here

      const obj2 = generateDeepObjectFixture();
      obj2.phoneNumbers[0].number = '123';
      obj2.phoneNumbers[1].number = '456';
      expect(observedObj).toReallyEqual(obj2);
    });

    describe(
      'should be called when the changes are already in place',
      function() {
        describe('Object', function() {
          it('Addition', function() {
            const obj = {
              firstName: 'Albert'
            };
            const jsonPatcherProxy = new JSONPatcherProxy(obj);

            const observedObj = jsonPatcherProxy.observe(true, function(_patches) {
              expect(observedObj.lastName).toReallyEqual('Newton');
            });

            observedObj.lastName = 'Newton';
          });

          it('Replacement', function() {
            const obj = {
              firstName: 'Albert'
            };
            const jsonPatcherProxy = new JSONPatcherProxy(obj);

            const observedObj = jsonPatcherProxy.observe(true, function(_patches) {
              expect(observedObj.firstName).toReallyEqual('Joachim');
            });

            observedObj.firstName = 'Joachim';
          });

          it('Deletion', function() {
            const obj = {
              firstName: 'Albert'
            };
            const jsonPatcherProxy = new JSONPatcherProxy(obj);

            const observedObj = jsonPatcherProxy.observe(true, function(_patches) {
              expect(observedObj.firstName).toReallyEqual(undefined);
            });

            delete observedObj.firstName;
          });
        });
        describe('Array', function() {
          it('Addition', function() {
            const obj = {
              firstName: 'Albert',
              numbers: [1, 2, 3]
            };
            const jsonPatcherProxy = new JSONPatcherProxy(obj);

            const observedObj = jsonPatcherProxy.observe(true, function(_patches) {
              expect(observedObj.numbers[3]).toReallyEqual(4);
            });

            observedObj.numbers.push(4);
          });

          it('Replacement', function() {
            const obj = {
              firstName: 'Albert',
              numbers: [1, 2, 3]
            };
            const jsonPatcherProxy = new JSONPatcherProxy(obj);

            const observedObj = jsonPatcherProxy.observe(true, function(_patches) {
              expect(observedObj.numbers[0]).toReallyEqual(100);
            });

            observedObj.numbers[0] = 100;
          });

          it('Deletion', function() {
            const obj = {
              firstName: 'Albert',
              numbers: [1, 2, 3]
            };
            const jsonPatcherProxy = new JSONPatcherProxy(obj);

            const observedObj = jsonPatcherProxy.observe(true, function(_patches) {
              expect(observedObj.numbers[0]).toReallyEqual(2);
            });

            observedObj.numbers.shift();
          });
        });
      }
    );

    it('generate should execute callback synchronously', function() {
      let lastPatches,
        called = 0,
        res;
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true, function(patches) {
        called++;
        lastPatches = [patches];
      });
      observedObj.phoneNumbers[0].number = '123';

      //needless too
      //setTimeout(function() {
      expect(called).toReallyEqual(1);

      res = jsonPatcherProxy.generate();
      expect(called).toReallyEqual(1);
      expect(lastPatches).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/0/number',
          value: '123'
        }
      ]);
      expect(lastPatches).toReallyEqual(res);

      res = jsonPatcherProxy.generate();
      expect(called).toReallyEqual(1);
      expect(lastPatches).toReallyEqual([
        {
          op: 'replace',
          path: '/phoneNumbers/0/number',
          value: '123'
        }
      ]);
      expect(res).toReallyEqual([]);

      // }, 100);
    });
  });
  describe('Already proxified values', function() {
    it('Shifting an array should refresh path correctly', function() {
      const obj = {
        arr: [{ name: 'omar' }, { name: 'ali' }]
      };

      const spy = jasmine.createSpy('spy');
      const observedObj = new JSONPatcherProxy(obj).observe(true, spy);

      observedObj.arr.shift();

      expect(spy.calls.count()).toEqual(2);

      //is it shifted?
      expect(observedObj.arr[0].name).toEqual('ali');

      // is newly-moved first items aware of its new path?
      observedObj.arr[0].name = 'steve';

      // should be called one more time
      expect(spy.calls.count()).toEqual(3);

      const args = spy.calls.mostRecent().args[0];

      expect(args).toEqual({
        op: 'replace',
        path: '/arr/0/name',
        value: 'steve'
      });
    });
    it('Moving an element in the array should change its path', function() {
      const obj = {
        arrayOfArrays: [[{ item1: 'item1' }], [{ item2: 'item2' }]]
      };

      const spy = jasmine.createSpy('spy');
      const observedObj = new JSONPatcherProxy(obj).observe(true, spy);
      const item2reference = observedObj.arrayOfArrays[1][0];
      item2reference.item2 = 'item2 modified';

      // control call, nothing important
      let args = spy.calls.mostRecent().args[0];

      // path is /arrayOfArrays/1/0/item2
      expect(args).toEqual({
        op: 'replace',
        path: '/arrayOfArrays/1/0/item2',
        value: 'item2 modified'
      });

      //remove first array element

      observedObj.arrayOfArrays.shift();

      item2reference.item2 = 'item2 modified again';

      args = spy.calls.mostRecent().args[0];

      //now item2reference.item2  path should change to "/arrayOfArrays/0/0/item2"
      expect(args).toEqual({
        op: 'replace',
        path: '/arrayOfArrays/0/0/item2',
        value: 'item2 modified again'
      });
    });
  });

  describe('stopping observing', function() {
    it("shouldn't emit patches after calling `disableTraps`", function() {
      const obj = {
        foo: 'bar'
      };

      let count = 0;
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true, function() {
        count++;
      });

      observedObj.foo = 'koko';

      expect(count).toReallyEqual(1);

      jsonPatcherProxy.disableTraps();

      observedObj.foo = 'momo';

      observedObj.foo = 'lolo';

      expect(count).toReallyEqual(1);
    });
    it('should throw a warning if object is modified after `disableTraps`', function() {
      const obj = {
        foo: 'bar'
      };

      let count = 0;
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true, function() {
        count++;
      });

      spyOn(console, 'warn');

      observedObj.foo = 'koko';

      expect(count).toReallyEqual(1);

      jsonPatcherProxy.disableTraps();

      observedObj.foo = 'momo';

      expect(count).toReallyEqual(1);
      expect(console.warn).toHaveBeenCalled();
    });
    it('should throw a warning if object is modified after detached', function() {
      const obj = { child: { name: 'omar' } };

      let count = 0;
      const jsonPatcherProxy = new JSONPatcherProxy(obj, true);
      const observedObj = jsonPatcherProxy.observe(true, function() {
        count++;
      });

      spyOn(console, 'warn');

      observedObj.child.name = 'Tomek';

      // change should emit a patch
      expect(count).toReallyEqual(1);

      //cache a sub-object
      const childObjectCached = observedObj.child;

      //detach it
      delete observedObj.child;

      // deletion patch
      expect(count).toReallyEqual(2);

      childObjectCached.name = 'Marcin';

      // shouldn't emit a patch
      expect(count).toReallyEqual(2);

      // but should warn about it
      expect(console.warn).toHaveBeenCalled();
    });
    it('should throw an error if object is modified after revoked', function() {
      const obj = { child: { name: 'omar' } };

      let count = 0;
      const jsonPatcherProxy = new JSONPatcherProxy(obj, true);
      const observedObj = jsonPatcherProxy.observe(true, function() {
        count++;
      });

      observedObj.child.name = 'Tomek';

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
      let called = 0;
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true, function(patches) {
        called++;
      });

      observedObj.firstName = 'Malvin';
      expect(called).toReallyEqual(1);

      observedObj.firstName = 'Ronaldo';
      expect(called).toReallyEqual(2);

      jsonPatcherProxy.pause();

      observedObj.firstName = 'Messi';
      expect(called).toReallyEqual(2);
    });

    it('Should re-start emitting patches when paused then resumed', function() {
      let called = 0;
      const obj = generateDeepObjectFixture();
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true, function(patches) {
        called++;
      });

      observedObj.firstName = 'Malvin';
      expect(called).toReallyEqual(1);

      observedObj.firstName = 'Ronaldo';
      expect(called).toReallyEqual(2);

      jsonPatcherProxy.pause();

      observedObj.firstName = 'Messi';
      expect(called).toReallyEqual(2);

      jsonPatcherProxy.resume();

      observedObj.firstName = 'Carlos';
      expect(called).toReallyEqual(3);
    });
    it('should handle callbacks that call resume() and pause() internally', function() {
      const obj = {
        foo: 'bar'
      };

      let count = 0;
      const jsonPatcherProxy = new JSONPatcherProxy(obj);
      const observedObj = jsonPatcherProxy.observe(true, function() {
        count++;
        jsonPatcherProxy.pause();
      });

      observedObj.foo = 'koko';
      // should emit once and then stop emitting

      observedObj.foo = 'momo';

      observedObj.foo = 'lolo';

      expect(count).toReallyEqual(1);

      jsonPatcherProxy.resume();

      //Should emit again
      observedObj.foo = 'fofo';

      expect(count).toReallyEqual(2);
    });
  });
});
