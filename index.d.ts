/*!
 * https://github.com/Palindrom/JSONPatcherProxy
 * JSONPatcherProxy version: 0.0.10
 * (c) 2017 Starcounter 
 * MIT license
 */

import { Operation } from 'fast-json-patch';

/** Class representing a JS Object observer  */
declare class JSONPatcherProxy<T> {
    /**
     * Deep clones your object and returns a new object.
     */
    public static deepClone(obj: any): any;
    public static escapePathComponent(str: string): string;

    /**
     * Creates an instance of JSONPatcherProxy around your object of interest, for later observe, unobserve, pause, resume calls. 
     * @param {Object|Array} root - the object you want to wrap
     * @param {Boolean} showDetachedWarning - whether to log a warning when a detached sub-object is modified. 
     * @returns {JSONPatcherProxy}
     * @constructor
     */
    constructor(root: T, showDetachedWarning?: boolean);

    private _isProxifyingTreeNow: boolean;
    private _isObserving: boolean;
    private _treeMetadataMap: Map<object, object>;
    private _parenthoodMap: Map<object, object>;
    private _showDetachedWarning: boolean;
    private _originalRoot: object;
    private _cachedProxy: object;
    private _isRecording: boolean;
    private _userCallback: Function;
    private _defaultCallback: Function;
    private _patches: Operation[];
    private _generateProxyAtKey(parent: object, tree: object, key: any): object;
    // grab tree's leaves one by one, encapsulate them into a proxy and return
    private _proxifyTreeRecursively(parent: object, tree: object, key: any): object;
    // this function is for aesthetic purposes
    private _proxifyRoot(root: object): object;
    /**
     * Turns a proxified object into a forward-proxy object; doesn't emit any patches anymore, like a normal object
     * @param {Object} treeMetadata
     */
    private _disableTrapsForTreeMetadata(treeMetadata: object): void;
    /**
     * Proxifies the object that was passed in the constructor and returns a proxified mirror of it. Even though both parameters are options. You need to pass at least one of them.
     * @param {Boolean} [record] - whether to record object changes to a later-retrievable patches array.
     * @param {Function} [callback] - this will be synchronously called with every object change with a single `patch` as the only parameter.
     */
    public observe(record: boolean, callback?: Function): object;
    /**
     * If the observed is set to record, it will synchronously return all the patches and empties patches array.
     */
    public generate(): Operation[];
    /**
     * Revokes all proxies rendering the observed object useless and good for garbage collection @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/revocable}
     */
    public revoke(): void;
    /**
     * Disables all proxies' traps, turning the observed object into a forward-proxy object, like a normal object that you can modify silently.
     */
    public disableTraps(): void;
    /**
     * Restores callback back to the original one provided to `observe`.
     */
    public resume(): void;
    /**
     * Replaces callback with a noop function.
     */
    public pause(): void;
}
export default JSONPatcherProxy;
