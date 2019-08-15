'use strict';

/*!
 * https://github.com/Palindrom/JSONPatcherProxy
 * (c) 2017 Starcounter
 * MIT license
 *
 * Vocabulary used in this file:
 *  * root - root object that is deeply observed by JSONPatcherProxy
 *  * tree - any subtree within the root or the root
 */

/** Class representing a JS Object observer  */
const JSONPatcherProxy = (function() {
  /**
  * Deep clones your object and returns a new object.
  */
  function deepClone(obj) {
    switch (typeof obj) {
      case 'object':
        return JSON.parse(JSON.stringify(obj)); //Faster than ES5 clone - http://jsperf.com/deep-cloning-of-objects/5
      case 'undefined':
        return null; //this is how JSON.stringify behaves for array items
      default:
        return obj; //no need to clone primitives
    }
  }
  JSONPatcherProxy.deepClone = deepClone;

  function escapePathComponent(str) {
    if (str.indexOf('/') == -1 && str.indexOf('~') == -1) return str;
    return str.replace(/~/g, '~0').replace(/\//g, '~1');
  }
  JSONPatcherProxy.escapePathComponent = escapePathComponent;

  /**
   * Walk up the parenthood tree to get the path
   * @param {JSONPatcherProxy} instance
   * @param {Object} tree the object you need to find its path
   */
  function getPathToTree(instance, tree) {
    const pathComponents = [];
    let parenthood = instance._parenthoodMap.get(tree);
    while (parenthood && parenthood.key) {
      // because we're walking up-tree, we need to use the array as a stack
      pathComponents.unshift(parenthood.key);
      parenthood = instance._parenthoodMap.get(parenthood.parent);
    }
    if (pathComponents.length) {
      const path = pathComponents.join('/');
      return '/' + path;
    }
    return '';
  }
  /**
   * A callback to be used as the proxy set trap callback.
   * It updates parenthood map if needed, proxifies nested newly-added objects, calls default callback with the changes occurred.
   * @param {JSONPatcherProxy} instance JSONPatcherProxy instance
   * @param {Object} tree the affected object
   * @param {String} key the effect property's name
   * @param {Any} newValue the value being set
   */
  function trapForSet(instance, tree, key, newValue) {
    const pathToKey = getPathToTree(instance, tree) + '/' + escapePathComponent(key);
    const subtreeMetadata = instance._treeMetadataMap.get(newValue);

    if (instance._treeMetadataMap.has(newValue)) {
      instance._parenthoodMap.set(subtreeMetadata.originalObject, { parent: tree, key });
    }
    /*
        mark already proxified values as inherited.
        rationale: proxy.arr.shift()
        will emit
        {op: replace, path: '/arr/1', value: arr_2}
        {op: remove, path: '/arr/2'}

        by default, the second operation would revoke the proxy, and this renders arr revoked.
        That's why we need to remember the proxies that are inherited.
      */
    /*
    Why do we need to check instance._isProxifyingTreeNow?

    We need to make sure we mark revocables as inherited ONLY when we're observing,
    because throughout the first proxification, a sub-object is proxified and then assigned to
    its parent object. This assignment of a pre-proxified object can fool us into thinking
    that it's a proxified object moved around, while in fact it's the first assignment ever.

    Checking _isProxifyingTreeNow ensures this is not happening in the first proxification,
    but in fact is is a proxified object moved around the tree
    */
    if (subtreeMetadata && !instance._isProxifyingTreeNow) {
      subtreeMetadata.inherited = true;
    }

    let warnedAboutNonIntegrerArrayProp = false;
    const isTreeAnArray = Array.isArray(tree);
    const isNonSerializableArrayProperty = isTreeAnArray && !Number.isInteger(+key.toString());

    // if the new value is an object, make sure to watch it
    if (
      newValue &&
      typeof newValue == 'object' &&
      !instance._treeMetadataMap.has(newValue)
    ) {
      if (isNonSerializableArrayProperty) {
        // This happens in Vue 1-2 (should not happen in Vue 3). See: https://github.com/vuejs/vue/issues/427, https://github.com/vuejs/vue/issues/9259
        console.warn(`JSONPatcherProxy noticed a non-integer property ('${key}') was set for an array. This interception will not emit a patch. The value is an object, but it was not proxified, because it would not be addressable in JSON-Pointer`);
        warnedAboutNonIntegrerArrayProp = true;
      }
      else {
        instance._parenthoodMap.set(newValue, { parent: tree, key });
        newValue = instance._proxifyTreeRecursively(tree, newValue, key);
      }
    }
    // let's start with this operation, and may or may not update it later
    const valueBeforeReflection = tree[key];
    const wasKeyInTreeBeforeReflection = tree.hasOwnProperty(key);
    if (isTreeAnArray && !isNonSerializableArrayProperty) {
      const index = parseInt(key, 10);
      if (index > tree.length) {
        // force call trapForSet for implicit undefined elements of the array added by the JS engine
        // because JSON-Patch spec prohibits adding an index that is higher than array.length
        trapForSet(instance, tree, (index - 1) + '', undefined);
      }
    }
    const reflectionResult = Reflect.set(tree, key, newValue);
    const operation = {
      op: 'remove',
      path: pathToKey
    };
    if (typeof newValue == 'undefined') {
      // applying De Morgan's laws would be a tad faster, but less readable
      if (!isTreeAnArray && !wasKeyInTreeBeforeReflection) {
        // `undefined` is being set to an already undefined value, keep silent
        return reflectionResult;
      } else {
        if (wasKeyInTreeBeforeReflection && !isSignificantChange(valueBeforeReflection, newValue, isTreeAnArray)) {
          return reflectionResult; // Value wasn't actually changed with respect to its JSON projection
        }
        // when array element is set to `undefined`, should generate replace to `null`
        if (isTreeAnArray) {
          operation.value = null;
          if (wasKeyInTreeBeforeReflection) {
            operation.op = 'replace';
          }
          else {
            operation.op = 'add';
          }
        }
        const oldSubtreeMetadata = instance._treeMetadataMap.get(valueBeforeReflection);
        if (oldSubtreeMetadata) {
          //TODO there is no test for this!
          instance._parenthoodMap.delete(valueBeforeReflection);
          instance._disableTrapsForTreeMetadata(oldSubtreeMetadata);
          instance._treeMetadataMap.delete(oldSubtreeMetadata);
        }
      }
    } else {
      if (isNonSerializableArrayProperty) {
        /* array props (as opposed to indices) don't emit any patches, to avoid needless `length` patches */
        if(key != 'length' && !warnedAboutNonIntegrerArrayProp) {
          console.warn(`JSONPatcherProxy noticed a non-integer property ('${key}') was set for an array. This interception will not emit a patch`);
        }
        return reflectionResult;
      }
      operation.op = 'add';
      if (wasKeyInTreeBeforeReflection) {
        if (typeof valueBeforeReflection !== 'undefined' || isTreeAnArray) {
          if (!isSignificantChange(valueBeforeReflection, newValue, isTreeAnArray)) {
            return reflectionResult; // Value wasn't actually changed with respect to its JSON projection
          }
          operation.op = 'replace'; // setting `undefined` array elements is a `replace` op
        }
      }
      operation.value = newValue;
    }
    instance._defaultCallback(operation);
    return reflectionResult;
  }
  /**
   * Test if replacing old value with new value is a significant change, i.e. whether or not
   * it soiuld result in a patch being generated.
   * @param {*} oldValue old value
   * @param {*} newValue new value
   * @param {boolean} isTreeAnArray value resides in an array
   */
  function isSignificantChange(oldValue, newValue, isTreeAnArray) {
    if (isTreeAnArray) {
      return isSignificantChangeInArray(oldValue, newValue);
    } else {
      return isSignificantChangeInObject(oldValue, newValue);
    }
  }
  /**
   * Test if replacing old value with new value is a significant change in an object, i.e.
   * whether or not it should result in a patch being generated.
   * @param {*} oldValue old value
   * @param {*} newValue new value
   */
  function isSignificantChangeInObject(oldValue, newValue) {
    return oldValue !== newValue;
  }
  /**
   * Test if replacing old value with new value is a significant change in an array, i.e.
   * whether or not it should result in a patch being generated.
   * @param {*} oldValue old value
   * @param {*} newValue new value
   */
  function isSignificantChangeInArray(oldValue, newValue) {
    if (typeof oldValue === 'undefined') {
      oldValue = null;
    }
    if (typeof newValue === 'undefined') {
      newValue = null;
    }
    return oldValue !== newValue;
  }
  /**
   * A callback to be used as the proxy delete trap callback.
   * It updates parenthood map if needed, calls default callbacks with the changes occurred.
   * @param {JSONPatcherProxy} instance JSONPatcherProxy instance
   * @param {Object} tree the effected object
   * @param {String} key the effected property's name
   */
  function trapForDeleteProperty(instance, tree, key) {
    const oldValue = tree[key];
    const reflectionResult = Reflect.deleteProperty(tree, key);
    if (typeof oldValue !== 'undefined') {
      const pathToKey = getPathToTree(instance, tree) + '/' + escapePathComponent(key);
      const subtreeMetadata = instance._treeMetadataMap.get(oldValue);

      if (subtreeMetadata) {
        if (subtreeMetadata.inherited) {
          /*
            this is an inherited proxy (an already proxified object that was moved around),
            we shouldn't revoke it, because even though it was removed from path1, it is still used in path2.
            And we know that because we mark moved proxies with `inherited` flag when we move them

            it is a good idea to remove this flag if we come across it here, in trapForDeleteProperty.
            We DO want to revoke the proxy if it was removed again.
          */
          subtreeMetadata.inherited = false;
        } else {
          instance._parenthoodMap.delete(subtreeMetadata.originalObject);
          instance._disableTrapsForTreeMetadata(subtreeMetadata);
          instance._treeMetadataMap.delete(oldValue);
        }
      }

      instance._defaultCallback({
        op: 'remove',
        path: pathToKey
      });
    }
    return reflectionResult;
  }
  /**
    * Creates an instance of JSONPatcherProxy around your object of interest `root`.
    * @param {Object|Array} root - the object you want to wrap
    * @param {Boolean} [showDetachedWarning = true] - whether to log a warning when a detached sub-object is modified @see {@link https://github.com/Palindrom/JSONPatcherProxy#detached-objects}
    * @returns {JSONPatcherProxy}
    * @constructor
    */
  function JSONPatcherProxy(root, showDetachedWarning) {
    this._isProxifyingTreeNow = false;
    this._isObserving = false;
    this._treeMetadataMap = new Map();
    this._parenthoodMap = new Map();
    // default to true
    if (typeof showDetachedWarning !== 'boolean') {
      showDetachedWarning = true;
    }

    this._showDetachedWarning = showDetachedWarning;
    this._originalRoot = root;
    this._cachedProxy = null;
    this._isRecording = false;
    this._userCallback;
    this._defaultCallback;
    this._patches;
  }

  JSONPatcherProxy.prototype._generateProxyAtKey = function(parent, tree, key) {
    if (!tree) {
      return tree;
    }
    const handler = {
      set: (...args) => trapForSet(this, ...args),
      deleteProperty: (...args) => trapForDeleteProperty(this, ...args)
    };
    const treeMetadata = Proxy.revocable(tree, handler);
    // cache the object that contains traps to disable them later.
    treeMetadata.handler = handler;
    treeMetadata.originalObject = tree;

    /* keeping track of the object's parent and the key within the parent */
    this._parenthoodMap.set(tree, { parent, key });

    /* keeping track of all the proxies to be able to revoke them later */
    this._treeMetadataMap.set(treeMetadata.proxy, treeMetadata);
    return treeMetadata.proxy;
  };
  // grab tree's leaves one by one, encapsulate them into a proxy and return
  JSONPatcherProxy.prototype._proxifyTreeRecursively = function(parent, tree, key) {
    for (let key in tree) {
      if (tree.hasOwnProperty(key)) {
        if (tree[key] instanceof Object) {
          tree[key] = this._proxifyTreeRecursively(
            tree,
            tree[key],
            escapePathComponent(key)
          );
        }
      }
    }
    return this._generateProxyAtKey(parent, tree, key);
  };
  // this function is for aesthetic purposes
  JSONPatcherProxy.prototype._proxifyRoot = function(root) {
    /*
    while proxifying object tree,
    the proxifying operation itself is being
    recorded, which in an unwanted behavior,
    that's why we disable recording through this
    initial process;
    */
    this.pause();
    this._isProxifyingTreeNow = true;
    const proxifiedRoot = this._proxifyTreeRecursively(
      undefined,
      root,
      ''
    );
    /* OK you can record now */
    this._isProxifyingTreeNow = false;
    this.resume();
    return proxifiedRoot;
  };
  /**
   * Turns a proxified object into a forward-proxy object; doesn't emit any patches anymore, like a normal object
   * @param {Object} treeMetadata
   */
  JSONPatcherProxy.prototype._disableTrapsForTreeMetadata = function(treeMetadata) {
    if (this._showDetachedWarning) {
      const message =
        "You're accessing an object that is detached from the observedObject tree, see https://github.com/Palindrom/JSONPatcherProxy#detached-objects";

      treeMetadata.handler.set = (
        parent,
        key,
        newValue
      ) => {
        console.warn(message);
        return Reflect.set(parent, key, newValue);
      };
      treeMetadata.handler.set = (
        parent,
        key,
        newValue
      ) => {
        console.warn(message);
        return Reflect.set(parent, key, newValue);
      };
      treeMetadata.handler.deleteProperty = (
        parent,
        key
      ) => {
        return Reflect.deleteProperty(parent, key);
      };
    } else {
      delete treeMetadata.handler.set;
      delete treeMetadata.handler.get;
      delete treeMetadata.handler.deleteProperty;
    }
  };
  /**
   * Proxifies the object that was passed in the constructor and returns a proxified mirror of it. Even though both parameters are options. You need to pass at least one of them.
   * @param {Boolean} [record] - whether to record object changes to a later-retrievable patches array.
   * @param {Function} [callback] - this will be synchronously called with every object change with a single `patch` as the only parameter.
   */
  JSONPatcherProxy.prototype.observe = function(record, callback) {
    if (!record && !callback) {
      throw new Error('You need to either record changes or pass a callback');
    }
    this._isRecording = record;
    this._userCallback = callback;
    /*
    I moved it here to remove it from `unobserve`,
    this will also make the constructor faster, why initiate
    the array before they decide to actually observe with recording?
    They might need to use only a callback.
    */
    if (record) this._patches = [];
    this._cachedProxy = this._proxifyRoot(this._originalRoot);
    return this._cachedProxy;
  };
  /**
   * If the observed is set to record, it will synchronously return all the patches and empties patches array.
   */
  JSONPatcherProxy.prototype.generate = function() {
    if (!this._isRecording) {
      throw new Error('You should set record to true to get patches later');
    }
    return this._patches.splice(0, this._patches.length);
  };
  /**
   * Revokes all proxies, rendering the observed object useless and good for garbage collection @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/revocable}
   */
  JSONPatcherProxy.prototype.revoke = function() {
    this._treeMetadataMap.forEach(el => {
      el.revoke();
    });
  };
  /**
   * Disables all proxies' traps, turning the observed object into a forward-proxy object, like a normal object that you can modify silently.
   */
  JSONPatcherProxy.prototype.disableTraps = function() {
    this._treeMetadataMap.forEach(this._disableTrapsForTreeMetadata, this);
  };
  /**
   * Restores callback back to the original one provided to `observe`.
   */
  JSONPatcherProxy.prototype.resume = function() {
    this._defaultCallback = operation => {
      this._isRecording && this._patches.push(operation);
      this._userCallback && this._userCallback(operation);
    };
    this._isObserving = true;
  };
  /**
   * Replaces callback with a noop function.
   */
  JSONPatcherProxy.prototype.pause = function() {
    this._defaultCallback = () => {};
    this._isObserving = false;
  }
  return JSONPatcherProxy;
})();

if (typeof module !== 'undefined') {
  module.exports = JSONPatcherProxy;
  module.exports.default = JSONPatcherProxy;
}
