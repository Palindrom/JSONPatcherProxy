/*!
 * https://github.com/PuppetJS/JSONPatcherProxy
 * JSONPatcherProxy version: 0.0.3
 * (c) 2017 Starcounter 
 * MIT license
 */

/** Class representing a JS Object observer  */
var JSONPatcherProxy = (function() {

  var proxifiedObjectsMap = new Map();
  
    /**
    * Creates an instance of JSONPatcherProxy around your object of interest `root`. 
    * @param {Object|Array} root - the object you want to wrap
    * @param {Boolean} showDetachedWarning - whether to log a warning when a detached sub-object is modified @see {@link https://github.com/Palindrom/JSONPatcherProxy#detached-objects} 
    * @returns {JSONPatcherProxy}
    * @constructor
    */
  function JSONPatcherProxy(root, showDetachedWarning) {
    
    // default to true
    if(typeof showDetachedWarning !== 'boolean')  {
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
      this.defaultCallback = function() {};
    };
  }
  /**
  * Deep clones your object and returns a new object.
  */
  JSONPatcherProxy.deepClone = function(obj) {
    switch (typeof obj) {
      case "object":
        return JSON.parse(JSON.stringify(obj)); //Faster than ES5 clone - http://jsperf.com/deep-cloning-of-objects/5
      case "undefined":
        return null; //this is how JSON.stringify behaves for array items
      default:
        return obj; //no need to clone primitives
    }
  };
  JSONPatcherProxy.escapePathComponent = function(str) {
    if (str.indexOf("/") === -1 && str.indexOf("~") === -1) return str;
    return str.replace(/~/g, "~0").replace(/\//g, "~1");
  };
  JSONPatcherProxy.prototype.generateProxyAtPath = function(obj, path) {
    if (!obj) {
      return obj;
    }
    var instance = this;
    var traps = {
      get: function(target, propKey, receiver) {
        if (propKey.toString() === "_isProxified") {
          return true; //to distinguish proxies
        }
        return Reflect.get(target, propKey, receiver);
      },
      set: function(target, key, receiver) {
        var distPath = path +
          "/" +
          JSONPatcherProxy.escapePathComponent(key.toString());
        // if the new value is an object, make sure to watch it
        if (
          receiver /* because `null` is in object */ &&
          typeof receiver === "object" &&
          receiver._isProxified !== true
        ) {
          receiver = instance._proxifyObjectTreeRecursively(receiver, distPath);
        }
        if (typeof receiver === "undefined") {
          if (target.hasOwnProperty(key)) {
            // when array element is set to `undefined`, should generate replace to `null`
            if (Array.isArray(target)) {
              //undefined array elements are JSON.stringified to `null`
              instance.defaultCallback({
                op: "replace",
                path: distPath,
                value: null
              });
            } else {
              instance.defaultCallback({ op: "remove", path: distPath });
            }
            return Reflect.set(target, key, receiver);
          } else if (!Array.isArray(target)) {
            return Reflect.set(target, key, receiver);
          }
        }
        if (Array.isArray(target) && !Number.isInteger(+key.toString())) {
          return Reflect.set(target, key, receiver);
        }
        if (target.hasOwnProperty(key)) {
          if (typeof target[key] === "undefined") {
            if (Array.isArray(target)) {
              instance.defaultCallback({
                op: "replace",
                path: distPath,
                value: receiver
              });
            } else {
              instance.defaultCallback({
                op: "add",
                path: distPath,
                value: receiver
              });
            }
            return Reflect.set(target, key, receiver);
          } else {
            instance.defaultCallback({
              op: "replace",
              path: distPath,
              value: receiver
            });
            return Reflect.set(target, key, receiver);
          }
        } else {
          instance.defaultCallback({
            op: "add",
            path: distPath,
            value: receiver
          });
          return Reflect.set(target, key, receiver);
        }
      },
      deleteProperty: function(target, key) {
        if (typeof target[key] !== "undefined") {
          instance.defaultCallback({
            op: "remove",
            path: (
               path + "/" + JSONPatcherProxy.escapePathComponent(key.toString())
            )
          });
          const proxyInstance = proxifiedObjectsMap.get(target[key])
          if(proxyInstance) {
            disableTrapsForProxy.call(instance, proxyInstance);
          }
        }
        // else {
        return Reflect.deleteProperty(target, key);
      }
    };
    var proxy = Proxy.revocable(obj, traps);
    // cache traps object to disable them later.
    proxy.trapsInstance = traps;
    /* keeping track of all the proxies to be able to revoke them later */
    proxifiedObjectsMap.set(proxy.proxy, proxy);
    return proxy.proxy;
  };
  //grab tree's leaves one by one, encapsulate them into a proxy and return
  JSONPatcherProxy.prototype._proxifyObjectTreeRecursively = function(
    root,
    path
  ) {
    for (var key in root) {
      if (root.hasOwnProperty(key)) {
        if (typeof root[key] === "object") {
          var distPath = path + "/" + JSONPatcherProxy.escapePathComponent(key);
          root[key] = this.generateProxyAtPath(root[key], distPath);
          this._proxifyObjectTreeRecursively(root[key], distPath);
        }
      }
    }
    return this.generateProxyAtPath(root, path);
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
    var proxifiedObject = this._proxifyObjectTreeRecursively(root, "");
    /* OK you can record now */
    this.resume();
    return proxifiedObject;
  };
  /**
   * Turns a proxified object into a forward-proxy object; doesn't emit any patches anymore, like a normal object
   * @param {Proxy} proxy - The target proxy object
   */
   function disableTrapsForProxy(proxyInstance) {
      if(this.showDetachedWarning) {
          const message = "You're accessing an object that is detached from the observedObject tree, see https://github.com/Palindrom/JSONPatcherProxy#detached-objects";
          proxyInstance.trapsInstance.get = (a,b,c) => {
            console.warn(message);
            return Reflect.get(a,b,c);
          }
          proxyInstance.trapsInstance.set = (a,b,c) => {
            console.warn(message);
            return Reflect.set(a,b,c);
          }
          proxyInstance.trapsInstance.deleteProperty = (a,b,c) => {
            console.warn(message);
            return Reflect.deleteProperty(a,b,c);
          }
      } else {
        delete proxyInstance.trapsInstance.set;
        delete proxyInstance.trapsInstance.get;
        delete proxyInstance.trapsInstance.deleteProperty;
      }
    }
  /**
   * Proxifies the object that was passed in the constructor and returns a proxified mirror of it.
   * @param {Boolean} record - whether to record object changes to a later-retrievable patches array.
   * @param {Function} [callback] - this will be synchronously called with every object change with a single `patch` as the only parameter.
   */
  JSONPatcherProxy.prototype.observe = function(record, callback) {
    if (!record && !callback) {
      throw new Error(
        "You need to either record changes or pass a callback"
      );
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
    return this.cachedProxy = this.proxifyObjectTree(
      JSONPatcherProxy.deepClone(this.originalObject)
    );
  };
  /**
   * If the observed is set to record, it will synchronously return all the patches and empties patches array.
   */
  JSONPatcherProxy.prototype.generate = function() {
    if (!this.isRecording) {
      throw new Error("You should set record to true to get patches later");
    }
    return this.patches.splice(0, this.patches.length);
  };
  /**
   * Revokes all proxies rendering the observed object useless and good for garbage collection @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/revocable}
   */
  JSONPatcherProxy.prototype.revoke = function() {
    proxifiedObjectsMap.forEach(el => el.revoke());
  };
  /**
   * Disables all proxies' traps, turning the observed object into a forward-proxy object, like a normal object that you can modify silently.
   */
  JSONPatcherProxy.prototype.disableTraps = function() {
    proxifiedObjectsMap.forEach(disableTrapsForProxy.bind(this));
  };
  /**
   * Synchronously returns a snapshot of current object state
   * @deprecated
   */
  JSONPatcherProxy.prototype.unobserve = function() {
    //return a normal, non-proxified object
    return JSONPatcherProxy.deepClone(this.cachedProxy);
  };
  return JSONPatcherProxy;
})();

if(typeof module !== 'undefined') {
  module.exports = JSONPatcherProxy;
  module.exports.default = JSONPatcherProxy;
}
