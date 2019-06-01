/*!
 * https://github.com/PuppetJS/JSONPatcherProxy
 * JSONPatcherProxy version: 0.0.6
 * (c) 2017 Starcounter 
 * MIT license
 */

import { Operation } from 'fast-json-patch';

/** Class representing a JS Object observer  */
declare class JSONPatcherProxy<T> {
    /**
    * Deep clones your object and returns a new object.
    */
    public static deepClone(obj);
    private originalRoot;
    private cachedProxy;
    private patches;
    private isRecording;
    private defaultCallback;
    private userCallback: Function;
    /**
     * @memberof JSONPatcherProxy
     * Replaces your callback with a noop function.
     */
    public pause: Function;
    /**
     * @memberof JSONPatcherProxy
     * Restores callback back to the original one provided to `observe`.
     */
    public resume: Function;

    private static escapePathComponent(str);
    private _generateProxyAtKey(parent, tree, key);
    private _proxifyTreeRecursively(parent, tree, key);
    private proxifyRoot(root);
    /**
    * Creates an instance of JSONPatcherProxy around your object of interest, for later observe, unobserve, pause, resume calls. 
    * @param {Object|Array} root - the object you want to wrap
    * @param {Boolean} showDetachedWarning - whether to log a warning when a detached sub-object is modified. 
    * @returns {JSONPatcherProxy}
    * @constructor
    */
    constructor(root: T, showDetachedWarning?: boolean);
    /**
     * Proxifies the object that was passed in the constructor and returns a proxified mirror of it.
     * @param {Boolean} record - whether to record object changes to a later-retrievable patches array.
     * @param {Function} [callback] - this will be synchronously called with every object change.
     */
    /**
     * Disables all proxies' traps, turning the observed object into a forward-proxy object, like a normal object that you can modify silently.
     */
    public disableTraps: Function;
     /**
     * Proxifies the object that was passed in the constructor and returns a proxified mirror of it.
     * @param {Boolean} record - whether to record object changes to a later-retrievable patches array.
     * @param {Function} [callback] - this will be synchronously called with every object change with a single `patch` as the only parameter.
     */
    public observe(record: Boolean, callback?: (patch: Operation) => any): any;
    /**
     * If the observed is set to record, it will synchronously return all the patches and empties patches array.
     */
    public generate(): Operation[];
}
export default JSONPatcherProxy;
