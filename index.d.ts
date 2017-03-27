/*!
 * https://github.com/PuppetJS/JSONPatcherProxy
 * JSONPatcherProxy version: 0.0.1
 * (c) 2017 Starcounter 
 * MIT license
 */

/** Class representing a JS Object observer  */
declare class JSONPatcherProxy {
    /**
    * Deep clones your object and returns a new object.
    */
    public static deepClone(obj);
    private originalObject;
    private exposedObject;
    private cachedProxy;
    private patches;
    private isRecording;
    private defaultCallback;
    private userCallback: Function;
    /**
    * Disables recording and/or callback firing when object modifications happen.
    */
    public switchObserverOff: Function;
    /**
    * Enables recording and/or callback firing when object modifications happen.
    */
    public switchObserverOn: Function;
    private static escapePathComponent(str);
    private generateProxyAtPath(obj, path);
    private _proxifyObjectTreeRecursively(root, path);
    private proxifyObjectTree(root);
    /**
    * Creates an instance of JSONPatcherProxy around your object of interest, for later observe, unobserve, switchCallbackOff, switchCallbackOn calls. 
    * @param {Object|Array} root - the object you want to wrap
    * @returns {JSONPatcherProxy}
    * @constructor
    */
    constructor(root: any);
    /**
     * Proxifies the object that was passed in the constructor and returns a proxified mirror of it.
     * @param {Boolean} record - whether to record object changes to a later-retrievable patches array.
     * @param {Function} [callback] - this will be synchronously called with every object change.
     */
    public observe(record: any, callback: any): any;
    /**
     * If the observed is set to record, it will synchronously return all the patches and empties patches array.
     */
    public generate(): Object[];
    /**
     * Synchronously de-proxifies the last state of the object and returns it unobserved.
     */
    public unobserve(): any;
}
export default JSONPatcherProxy;
