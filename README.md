# JSONPatcherProxy
<p align="center">
  <img alt="JSONPatcherProxy" src="https://user-images.githubusercontent.com/17054134/28315402-86a59eae-6bbe-11e7-82e9-45bacd7f8cc1.png">
</p>

---

> [ES6 proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) powered JSON Object observer that emits JSON patches when changes occur to your object tree.

[![Build Status](https://travis-ci.org/Palindrom/JSONPatcherProxy.svg?branch=master)](https://travis-ci.org/Palindrom/JSONPatcherProxy)

With JSONPatcherProxy, you don't need polling or dirty checking. Any changes to the object are synchronously emitted.

## Why you should use JSONPatcherProxy

JSON-Patch [(RFC6902)](http://tools.ietf.org/html/rfc6902) is a standard format that
allows you to update a JSON document by sending the changes rather than the whole document.
JSONPatcherProxy plays well with the HTTP PATCH verb (method) and REST style programming.

Mark Nottingham has a [nice blog]( http://www.mnot.net/blog/2012/09/05/patch) about it.

## Footprint
* 1.30 KB minified and gzipped (3.25 KB minified)

## Features
* Allows you to watch an object and record all patches for later usage.
* Allows you to watch an object and handle individual patches synchronously through a callback.
* Tested in Edge, Firefox, Chrome, Safari and Node.js.

## Install

Install the current version (and save it as a dependency):

### npm

```sh
$ npm install jsonpatcherproxy --save
```

### [Download as ZIP](https://github.com/Starcounter-Jack/JSON-Patch/archive/master.zip)


## Adding to your project

### In a web browser

* Include `dist/jsonpatcherproxy.min.js`,  as in:
```
<script src="dist/jsonpatcherproxy.js"></script>
```

**You can use rawgit.com as a CDN**.

### In Node.js

Call require to get the instance:

```js
var JSONPatcherProxy = require('jsonpatcherproxy');
```
Or in ES6 and TS:
```js
import JSONPatcherProxy from 'jsonpatcherproxy';
```
## Usage

### Generating patches:

```js
var myObj = { firstName:"Joachim", lastName:"Wester", contactDetails: { phoneNumbers: [ { number:"555-123" }] } };
var jsonPatcherProxy = new JSONPatcherProxy( myObj );
var observedObject = jsonPatcherProxy.observe(true);
observedObject.firstName = "Albert";
observedObject.contactDetails.phoneNumbers[0].number = "123";
observedObject.contactDetails.phoneNumbers.push({number:"456"});
var patches = jsonPatcherProxy.generate();
// patches  == [
//   { op:"replace", path="/firstName", value:"Albert"},
//   { op:"replace", path="/contactDetails/phoneNumbers/0/number", value:"123"},
//   { op:"add", path="/contactDetails/phoneNumbers/1", value:{number:"456"}}];
```

### Receiving patches in a callback:

```js
var myObj = { firstName:"Joachim", lastName:"Wester", contactDetails: { phoneNumbers: [ { number:"555-123" }] } };
var jsonPatcherProxy = new JSONPatcherProxy( myObj );
var observedObject = jsonPatcherProxy.observe(true, function(patch) {
    // patch == { op:"replace", path="/firstName", value:"Albert"}
});
observedObject.firstName = "Albert";
```

## API

## Object observing

#### constructor: JSONPatcherProxy( `root` Object, [`showDetachedWarning` Boolean = true] ):  JSONPatcherProxy

Creates an instance of `JSONPatcherProxy` around your object of interest `root`, for later `observe`, `unobserve`, `pause`, `resume` calls.
Returns `JSONPatcherProxy`.

`root`: The object tree you want to observe

`showDetachedWarning`: Modifying a child object that is detached from the parent tree is not recommended, because the object will continue to be a Proxy. That's why JSONPatcherProxy warns when a detached proxy is accessed. You can set this to false to disable those warnings.


#### JSONPatcherProxy#observe(`record` Boolean, [`callback` Function]): Proxy

Sets up a deep proxy observer on `root` that listens for changes in the tree. When changes are detected, the optional callback is called with the generated **single** patch as the parameter.

**record**: if set to `false`, all changes are will be pass through the callback and no history will be kept. If set to `true` patches history will be kept until you call `generate`, this will return **several** patches and deletes them from history.

Returns  a `Proxy` mirror of your object.

- Note 1: you must either set `record` to `true` or pass a callback.
- Note 2: you have to use the return value of this function as your object of interest. Changes to the original object will go unnoticed.
- Note 3: please make sure to call `JSONPatcherProxy#generate` often if you choose to record. Because the patches will accumulate if you don't.

🚨 Generated patches are not immutable. See "Limitations" below.

#### JSONPatcherProxy#generate () :  Array

It returns the changes of your object since the last time it's called. You have to be recording (by setting `record` to `true`) when calling `JSONPatcherProxy#observe`.

If there are no pending changes in `root`, returns an empty array (length 0).

🚨 Generated patches are not immutable. See "Limitations" below.

#### JSONPatcherProxy#pause () : void

Disables patches emitting (to both callback and patches array). However, the object will be updated if you change it.

#### JSONPatcherProxy#resume () : void

Enables patches emitting (to both callback and patches array). Starting from the moment you call it.

#### JSONPatcherProxy#revoke () : void

De-proxifies (revokes) all the proxies that were created either in #observe call or by adding sub-objects to the tree in runtime.

#### JSONPatcherProxy#disableTraps () : void

Turns the proxified object into a forward-proxy object; doesn't emit any patches anymore, like a normal object.

## `undefined`s (JS to JSON projection)

As `undefined` type does not exist in JSON, it's also not a valid value of JSON Patch operation. Therefore `JSONPatcherProxy` will not generate JSON Patches that sets anything to `undefined`.

Whenever a value is set to `undefined` in JS, JSONPatcherProxy method `generate` and `compare` will treat it similarly to how JavaScript method [`JSON.stringify` (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) treats them:

> If `undefined` (...) is encountered during conversion it is either omitted (when it is found in an object) or censored to `null` (when it is found in an array).

See the [ECMAScript spec](http://www.ecma-international.org/ecma-262/6.0/index.html#sec-json.stringify) for details.

## Limitations

1. **It mutates your original object**: During proxification, JSONPatcherProxy mutates the object you pass to it. Because it doesn't deep-clone for better performance. If you want your original object to remain untouched, please deep-clone before you pass it to the constructor.

2. **It does not support multi-level proxification**: During proxification, it recursively traverses the object and sets each property to its new proxified version. This means you can't proxify an already proxified object because the original proxy will record proxification as a series of changes. And the emitted patches are unpredictable. Also, when you change a property from either one of the proxies, both of the proxies will emit patches in an undefined manner.

3. **Generated patches are not immutable**. The patches generated by JSONPatcherProxy contain reference to the profixied object as the patch `value`. You should either serialize the patch to JSON immediately or deep clone the value it if you want to process it later. If you don't do that, you run the risk that reading the patch will contain changes added after the patch was generated.

## Specs/tests

#### In browser

Go to `/test`

In Node run:

```
npm test
```

## Contributing

* Fork it.
* Clone it locally.
* Run `npm install`.
* Run `npm test` to make sure tests pass before touching the code.
* Modify, test again, push, and send a PR!

## Bumping the version

Version bumping is automated. Just use [`npm version`](https://docs.npmjs.com/cli/version) command and all files will be updated with the new version.

## License

MIT
