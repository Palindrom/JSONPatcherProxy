'use strict';
/**
 * A helper function that calls Reflect.set.
 * It is utilized to re-populate path history map after every `Reflect.set` call.
 * @param {JSONPatcherProxy} instance JSONPatcherProxy instance
 * @param {Object} target target object
 * @param {string} key affected property name 
 * @param {any} newValue the new set value
 */
function ownReflectSet(instance, target, key, newValue) {
  const result = Reflect.set(target, key, newValue);
  /* we traverse the new (post-apply) object and update proxies paths accordingly */
  instance._resetCachedProxiesPaths(instance.cachedProxy, '');
  return result;
}
/*!
 * https://github.com/PuppetJS/JSONPatcherProxy
 * JSONPatcherProxy version: 0.0.5
 * (c) 2017 Starcounter 
 * MIT license
 */

/** Class representing a JS Object observer  */
const JSONPatcherProxy = (function() {
  /**
    * Creates an instance of JSONPatcherProxy around your object of interest `root`. 
    * @param {Object|Array} root - the object you want to wrap
    * @param {Boolean} [showDetachedWarning] - whether to log a warning when a detached sub-object is modified @see {@link https://github.com/Palindrom/JSONPatcherProxy#detached-objects} 
    * @returns {JSONPatcherProxy}
    * @constructor
    */
  function JSONPatcherProxy(root, showDetachedWarning) {
    this.proxifiedObjectsMap = new Map();
    this.objectsPathsMap = new Map();
    // default to true
    if (typeof showDetachedWarning !== 'boolean') {
      showDetachedWarning = true;
    }

    this.showDetachedWarning = showDetachedWarning;
    this.originalObject = root;
    this.cachedProxy = null;
    this.isRecording = false;
    this.userCallback;
    /**
     * @memberof JSONPatcherProxy
     * Restores callback back to the original one provided to `observe`.
     */
    this.resume = () => {
      this.defaultCallback = operation => {
        this.isRecording && this.patches.push(operation);
        this.userCallback && this.userCallback(operation);
      };
    };
    /**
     * @memberof JSONPatcherProxy
     * Replaces your callback with a noop function.
     */
    this.pause = () => {
      this.defaultCallback = () => {};
    };
  }
  /**
  * Deep clones your object and returns a new object.
  */
  JSONPatcherProxy.deepClone = function(obj) {
    switch (typeof obj) {
      case 'object':
        return JSON.parse(JSON.stringify(obj)); //Faster than ES5 clone - http://jsperf.com/deep-cloning-of-objects/5
      case 'undefined':
        return null; //this is how JSON.stringify behaves for array items
      default:
        return obj; //no need to clone primitives
    }
  };
  JSONPatcherProxy.escapePathComponent = function(str) {
    if (str.indexOf('/') === -1 && str.indexOf('~') === -1) return str;
    return str.replace(/~/g, '~0').replace(/\//g, '~1');
  };
  /**
    * A helper function that retrieves the object path from object paths map. 
    * And if it failed to find it, it sets it for future retrieval.
    * @param {Object} target the object that you need its path
    * @param {String} string the path used when object is not found in object-path cache
  */
  JSONPatcherProxy.prototype.getOrSetObjectPath = function(target, path) {
    const cachedPath = this.objectsPathsMap.get(target);
    if (cachedPath) {
      return cachedPath;
    } else {
      this.objectsPathsMap.set(target, path);
      return path;
    }
  };

  JSONPatcherProxy.prototype.generateProxyAtPath = function(obj, path) {
    if (!obj) {
      return obj;
    }
    const instance = this;
    const traps = {
      get: function(target, propKey, newValue) {
        if (propKey.toString() === '_isProxified') {
          return true; //to distinguish proxies
        }
        return Reflect.get(target, propKey, newValue);
      },
      set: function(target, key, newValue) {

        /* each proxified object has its path cached, we need to use that instead of `path` variable
        because at one point in the future, paths might change and we will simply update our cache instead of 
        proxifying again.  */

        var destinationPropKey = instance.getOrSetObjectPath(target, path) + '/' + JSONPatcherProxy.escapePathComponent(key);

        /* in case the set value is already proxified by a different instance of JSONPatcherProxy */
        if (
          newValue &&
          newValue._isProxified &&
          !instance.proxifiedObjectsMap.has(newValue)
        ) {
          newValue = JSONPatcherProxy.deepClone(newValue);
        }

        // if the new value is an object, make sure to watch it
        if (
          newValue &&
          typeof newValue === 'object' &&
          newValue._isProxified !== true
        ) {
          newValue = instance._proxifyObjectTreeRecursively(newValue, destinationPropKey);
        }
        if (typeof newValue === 'undefined') {
          if (target.hasOwnProperty(key)) {
            // when array element is set to `undefined`, should generate replace to `null`
            if (Array.isArray(target)) {
              //undefined array elements are JSON.stringified to `null`
              instance.defaultCallback({
                op: 'replace',
                path: destinationPropKey,
                value: null
              });
            } else {
              instance.defaultCallback({ op: 'remove', path: destinationPropKey });
            }
            return ownReflectSet(instance, target, key, newValue);
          } else if (!Array.isArray(target)) {
            return ownReflectSet(instance, target, key, newValue);
          }
        }
        if (Array.isArray(target) && !Number.isInteger(+key.toString())) {
          return ownReflectSet(instance, target, key, newValue);
        }
        if (target.hasOwnProperty(key)) {
          if (typeof target[key] === 'undefined') {
            if (Array.isArray(target)) {
              instance.defaultCallback({
                op: 'replace',
                path: destinationPropKey,
                value: newValue
              });
            } else {
              instance.defaultCallback({
                op: 'add',
                path: destinationPropKey,
                value: newValue
              });
            }
            return ownReflectSet(instance, target, key, newValue);
          } else {
            instance.defaultCallback({
              op: 'replace',
              path: destinationPropKey,
              value: newValue
            });
            return ownReflectSet(instance, target, key, newValue);
          }
        } else {
          instance.defaultCallback({
            op: 'add',
            path: destinationPropKey,
            value: newValue
          });
          return ownReflectSet(instance, target, key, newValue);
        }
      },
      deleteProperty: function(target, key) {
        if (typeof target[key] !== 'undefined') {
          instance.defaultCallback({
            op: 'remove',
            path:
              path + '/' + JSONPatcherProxy.escapePathComponent(key.toString())
          });
          const revokableProxyInstance = instance.proxifiedObjectsMap.get(target[key]);

          if (revokableProxyInstance) {
            instance.objectsPathsMap.delete(revokableProxyInstance.originalObject);
            instance.disableTrapsForProxy(revokableProxyInstance);
            instance.proxifiedObjectsMap.delete(target[key]);
          }
        }
        const result = Reflect.deleteProperty(target, key);
        /* we need the Reflection to occur before we map paths to their object */
        instance._resetCachedProxiesPaths(instance.cachedProxy, '');
        return result;
      }
    };
    const revocableInstance = Proxy.revocable(obj, traps);
    // cache traps object to disable them later.
    revocableInstance.trapsInstance = traps;
    revocableInstance.originalObject = obj;
    /* keeping track of all the proxies to be able to revoke them later */
    this.proxifiedObjectsMap.set(revocableInstance.proxy, revocableInstance);
    return revocableInstance.proxy;
  };
  //grab tree's leaves one by one, encapsulate them into a proxy and return
  JSONPatcherProxy.prototype._proxifyObjectTreeRecursively = function(
    root,
    path
  ) {
    for (let key in root) {
      if (root.hasOwnProperty(key)) {
        if (typeof root[key] === 'object') {
          const destinationPropKey =
            path + '/' + JSONPatcherProxy.escapePathComponent(key);
          root[key] = this.generateProxyAtPath(root[key], destinationPropKey);
          this._proxifyObjectTreeRecursively(root[key], destinationPropKey);
        }
      }
    }
    return this.generateProxyAtPath(root, path);
  };
  JSONPatcherProxy.prototype._resetCachedProxiesPaths = function(root, path) {
    /* deleting array elements could render other array elements paths incorrect, 
    this function fixes all incorrect paths efficiently */
    for (let key in root) {
      if(!root.hasOwnProperty(key)) continue;
      const subObject = root[key];
      if (
        subObject && subObject._isProxified
      ) {
        const destinationPropKey = path + '/' + JSONPatcherProxy.escapePathComponent(key);

        // get the proxy instance (an instance is {proxy, originalObject})
        var revokableProxyInstance = this.proxifiedObjectsMap.get(subObject);
        if (revokableProxyInstance) {
          // get the un-proxified originalObject, we need because `set` trap passes the original object as target
          const originalObject = revokableProxyInstance.originalObject;
          // update its path
          this.objectsPathsMap.set(originalObject, destinationPropKey);
        }
        /* Even though we didn't find the proxy in the proxies-cache,
         We need to continue updating its descendants' paths,
         because we might come at this point in recursive calls inside `set` trap.
         Because we cache the proxy (revokableInstance) to proxies map only **after** the revokableInstance is created.
         And `set` trap can call this function before revokableInstance is created.
         This means we can come across totally valid proxies that are not cached in the our cache.
         We continue traversing them because we know 100% they're proxies (they have _isProxified = true).
         */
        this._resetCachedProxiesPaths(subObject, destinationPropKey);
      }
    }
  };
  //this function is for aesthetic purposes
  JSONPatcherProxy.prototype.proxifyObjectTree = function(root) {
    /*
    while proxyifying object tree,
    the proxyifying operation itself is being
    recorded, which in an unwanted behavior,
    that's why we disable recording through this
    initial process;
    */
    this.pause();
    const proxifiedObject = this._proxifyObjectTreeRecursively(root, '');
    /* OK you can record now */
    this.resume();
    return proxifiedObject;
  };
  /**
   * Turns a proxified object into a forward-proxy object; doesn't emit any patches anymore, like a normal object
   * @param {Proxy} proxy - The target proxy object
   */
  JSONPatcherProxy.prototype.disableTrapsForProxy = function(revokableProxyInstance) {
    if (this.showDetachedWarning) {
      const message =
        "You're accessing an object that is detached from the observedObject tree, see https://github.com/Palindrom/JSONPatcherProxy#detached-objects";
      
      revokableProxyInstance.trapsInstance.set = (targetObject, propKey, newValue) => {
        console.warn(message);
        return Reflect.set(targetObject, propKey, newValue);
      };
      revokableProxyInstance.trapsInstance.set = (targetObject, propKey, newValue) => {
        console.warn(message);
        return Reflect.set(targetObject, propKey, newValue);
      };
      revokableProxyInstance.trapsInstance.deleteProperty = (targetObject, propKey) => {
        return Reflect.deleteProperty(targetObject, propKey);
      };
    } else {
      delete revokableProxyInstance.trapsInstance.set;
      delete revokableProxyInstance.trapsInstance.get;
      delete revokableProxyInstance.trapsInstance.deleteProperty;
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
    this.isRecording = record;
    if (callback) this.userCallback = callback;
    /*
    I moved it here to remove it from `unobserve`,
    this will also make the constructor faster, why initiate
    the array before they decide to actually observe with recording?
    They might need to use only a callback.
    */
    if (record) this.patches = [];
    this.originalObject = JSONPatcherProxy.deepClone(this.originalObject);
    this.cachedProxy = this.proxifyObjectTree(this.originalObject);
    return this.cachedProxy;
  };
  /**
   * If the observed is set to record, it will synchronously return all the patches and empties patches array.
   */
  JSONPatcherProxy.prototype.generate = function() {
    if (!this.isRecording) {
      throw new Error('You should set record to true to get patches later');
    }
    return this.patches.splice(0, this.patches.length);
  };
  /**
   * Revokes all proxies rendering the observed object useless and good for garbage collection @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/revocable}
   */
  JSONPatcherProxy.prototype.revoke = function() {
    this.proxifiedObjectsMap.forEach(el => {
      el.revoke();
    });
  };
  /**
   * Disables all proxies' traps, turning the observed object into a forward-proxy object, like a normal object that you can modify silently.
   */
  JSONPatcherProxy.prototype.disableTraps = function() {
    this.proxifiedObjectsMap.forEach(this.disableTrapsForProxy, this);
  };
  return JSONPatcherProxy;
})();

if (typeof module !== 'undefined') {
  module.exports = JSONPatcherProxy;
  module.exports.default = JSONPatcherProxy;
}
