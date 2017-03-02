# JSONPatcherProxy
<p align="center">
  <img alt="JSONPatcherProxy" src="https://cloud.githubusercontent.com/assets/17054134/23507089/b0951b34-ff4b-11e6-967b-aa20da3dcd00.png">
</p> 

---

> [ES6 proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) powered JSON Object observer. That emits JSON patches when changes occur to your object tree.

[![Build Status](https://travis-ci.org/alshakero/JSONPatcherProxy.svg?branch=master)](https://travis-ci.org/Starcounter-Jack/JSON-Patch)

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

#### constructor: JSONPatcherProxy( `root` Object ):  JSONPatcherProxy

Creates an instance of `JSONPatcherProxy` around your object of interest `root`, for later `observe`, `unobserve`, `switchCallbackOff`, `switchCallbackOn` calls.
Returns `JSONPatcherProxy`.

#### JSONPatcherProxy#observe(`record` Boolean, [`callback` Function]): Proxy

Sets up a deep proxy observer on `root` that listens for changes in the tree. When changes are detected, the optional callback is called with the generated **single** patch as the parameter. 

**record**: if set to `false`, all changes are will be pass through the callback and no history will be kept. If set to `true` patches history will be kept until you call `generate`, this will return **several** patches and deletes them from history.

Returns  a `Proxy` mirror of your object.

- Note 1: you must either set `record` to `true` or pass a callback. 
- Note 2: you have to use the return value of this function as your object of interest. Changes to the original object will go unnoticed. 
- Note 3: please make sure to call `JSONPatcherProxy#generate` often if you choose to record. Because the patches will accumulate if you don't. 
- Note 4: the returned mirror object has a property `_isProxified` set to true, you can use this to tell an object and its mirror apart. Also if your `root` object or any deep object inside it has `_isProxified` property set to `true` it won't be proxified => will not emit patches.

#### JSONPatcherProxy#generate () :  Array

It returns the changes of your object since the last time it's called. You have to be recording (by setting `record` to `true`) when calling `JSONPatcherProxy#observe`.

If there are no pending changes in `root`, returns an empty array (length 0).

#### JSONPatcherProxy#unobserve () : Object

Returns the final state of your object, unobserved.

#### JSONPatcherProxy#switchCallbackOff () : void

Disables patches omitting (to both callback and patches array). However, the object will be updated if you change it. 

#### JSONPatcherProxy#switchCallbackOn () : void

Enables patches omitting (to both callback and patches array). Starting from the moment you call it. 


## `undefined`s (JS to JSON projection)

As `undefined` type does not exist in JSON, it's also not a valid value of JSON Patch operation. Therefore `JSONPatcherProxy` will not generate JSON Patches that sets anything to `undefined`.

Whenever a value is set to `undefined` in JS, JSONPatcherProxy method `generate` and `compare` will treat it similarly to how JavaScript method [`JSON.stringify` (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) treats them:

> If `undefined` (...) is encountered during conversion it is either omitted (when it is found in an object) or censored to `null` (when it is found in an array).

See the [ECMAScript spec](http://www.ecma-international.org/ecma-262/6.0/index.html#sec-json.stringify) for details.

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

## License

MIT


## Logo
Designed by _Medical_ from Flaticon.