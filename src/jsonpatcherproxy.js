'use strict;';

function ownReflectSet(instance, a, b, c) {
  /* we traverse the new (post-apply)
  object and update proxies paths accordingly */
  const result = Reflect.set(a, b, c);
  instance._resetCachedProxiesPaths(instance.cachedProxy, '');
  return ownReflectSet;
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
  JSONPatcherProxy.prototype.getOrSetPath = function(target, path, key) {
    var cachedProxy = this.objectsPathsMap.get(target);
    var distPath = path;
    if (cachedProxy) {
      distPath =
        cachedProxy +
        '/' +
        JSONPatcherProxy.escapePathComponent(key.toString());
    } else {
      // first time we meet this object
      distPath =
        path + '/' + JSONPatcherProxy.escapePathComponent(key.toString());

      // cache its path
      this.objectsPathsMap.set(target, path);
    }
    return distPath;
  };

  JSONPatcherProxy.prototype.generateProxyAtPath = function(obj, path) {
    if (!obj) {
      return obj;
    }
    const instance = this;
    const traps = {
      get: function(target, propKey, receiver) {
        if (propKey.toString() === '_isProxified') {
          return true; //to distinguish proxies
        }
        return Reflect.get(target, propKey, receiver);
      },
      set: function(target, key, receiver) {

        /* each proxified object has its path cached, we need to use that instead of `path` variable
        because at one point in the future, paths might change and we will simply update our cache instead of 
        proxifying again.  */

        var distPath = instance.getOrSetPath(target, path, key);

        /* in case the set value is already proxified by a different instance of JSONPatcherProxy */
        if (
          receiver &&
          receiver._isProxified &&
          !instance.proxifiedObjectsMap.has(receiver)
        ) {
          receiver = JSONPatcherProxy.deepClone(receiver);
        }

        // if the new value is an object, make sure to watch it
        if (
          receiver /* because `null` is in object */ &&
          typeof receiver === 'object' &&
          receiver._isProxified !== true
        ) {
          receiver = instance._proxifyObjectTreeRecursively(receiver, distPath);
        }
        if (typeof receiver === 'undefined') {
          if (target.hasOwnProperty(key)) {
            // when array element is set to `undefined`, should generate replace to `null`
            if (Array.isArray(target)) {
              //undefined array elements are JSON.stringified to `null`
              instance.defaultCallback({
                op: 'replace',
                path: distPath,
                value: null
              });
            } else {
              instance.defaultCallback({ op: 'remove', path: distPath });
            }
            return ownReflectSet(instance, target, key, receiver);
          } else if (!Array.isArray(target)) {
            return ownReflectSet(instance, target, key, receiver);
          }
        }
        if (Array.isArray(target) && !Number.isInteger(+key.toString())) {
          return ownReflectSet(instance, target, key, receiver);
        }
        if (target.hasOwnProperty(key)) {
          if (typeof target[key] === 'undefined') {
            if (Array.isArray(target)) {
              instance.defaultCallback({
                op: 'replace',
                path: distPath,
                value: receiver
              });
            } else {
              instance.defaultCallback({
                op: 'add',
                path: distPath,
                value: receiver
              });
            }
            return ownReflectSet(instance, target, key, receiver);
          } else {
            instance.defaultCallback({
              op: 'replace',
              path: distPath,
              value: receiver
            });
            return ownReflectSet(instance, target, key, receiver);
          }
        } else {
          instance.defaultCallback({
            op: 'add',
            path: distPath,
            value: receiver
          });
          return ownReflectSet(instance, target, key, receiver);
        }
      },
      deleteProperty: function(target, key) {
        if (typeof target[key] !== 'undefined') {
          instance.defaultCallback({
            op: 'remove',
            path:
              path + '/' + JSONPatcherProxy.escapePathComponent(key.toString())
          });
          const proxyInstance = instance.proxifiedObjectsMap.get(target[key]);

          if (proxyInstance) {
            instance.disableTrapsForProxy(proxyInstance.proxy);
            instance.proxifiedObjectsMap.delete(target[key]);
          }
        }
        const result = Reflect.deleteProperty(target, key);
        /* we need the Reflection to occur before we map paths to their object */
        instance._resetCachedProxiesPaths(instance.cachedProxy, '');
        return result;
      }
    };
    const proxy = Proxy.revocable(obj, traps);
    // cache traps object to disable them later.
    proxy.trapsInstance = traps;
    /* keeping track of all the proxies to be able to revoke them later */
    this.proxifiedObjectsMap.set(proxy.proxy, { proxy, originalObject: obj });
    return proxy.proxy;
  };
  //grab tree's leaves one by one, encapsulate them into a proxy and return
  JSONPatcherProxy.prototype._proxifyObjectTreeRecursively = function(
    root,
    path
  ) {
    for (let key in root) {
      if (root.hasOwnProperty(key)) {
        if (typeof root[key] === 'object') {
          const distPath =
            path + '/' + JSONPatcherProxy.escapePathComponent(key);
          root[key] = this.generateProxyAtPath(root[key], distPath);
          this._proxifyObjectTreeRecursively(root[key], distPath);
        }
      }
    }
    return this.generateProxyAtPath(root, path);
  };
  JSONPatcherProxy.prototype._resetCachedProxiesPaths = function(root, path) {
    /* deleting array elements could render other array elements paths incorrect, 
    this function fixes all incorrect paths efficiently */
    for (let key in root) {
      if (
        root.hasOwnProperty(key) &&
        root[key] &&
        typeof root[key] === 'object' &&
        root[key]._isProxified
      ) {
        const distPath = path + '/' + JSONPatcherProxy.escapePathComponent(key);

        // get the proxy instance (an instance is {proxy, originalObject})
        var proxyInstance = this.proxifiedObjectsMap.get(root[key]);
        if (proxyInstance) {
          // get the un-proxified originalObject, we need because `set` trap passes the original object as target
          const originalObject = proxyInstance.originalObject;
          // update its path
          this.objectsPathsMap.set(originalObject, distPath);
        }
        this._resetCachedProxiesPaths(root[key], distPath);
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
  JSONPatcherProxy.prototype.disableTrapsForProxy = function(proxyInstance) {
    if (this.showDetachedWarning) {
      const message =
        "You're accessing an object that is detached from the observedObject tree, see https://github.com/Palindrom/JSONPatcherProxy#detached-objects";
      proxyInstance.trapsInstance.set = (a, b, c) => {
        console.warn(message);
        return Reflect.set(a, b, c);
      };
      proxyInstance.trapsInstance.deleteProperty = (a, b, c) => {
        console.warn(message);
        return Reflect.deleteProperty(a, b, c);
      };
    } else {
      delete proxyInstance.trapsInstance.set;
      delete proxyInstance.trapsInstance.get;
      delete proxyInstance.trapsInstance.deleteProperty;
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
      el.proxy.revoke();
    });
  };
  /**
   * Disables all proxies' traps, turning the observed object into a forward-proxy object, like a normal object that you can modify silently.
   */
  JSONPatcherProxy.prototype.disableTraps = function() {
    this.proxifiedObjectsMap.forEach(el => this.disableTrapsForProxy(el.proxy));
  };
  return JSONPatcherProxy;
})();

if (typeof module !== 'undefined') {
  module.exports = JSONPatcherProxy;
  module.exports.default = JSONPatcherProxy;
}
