/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

// see: https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Object/keys#Compatiblity
if (!Object.keys) Object.keys = function Object_keys(o) {
  if (o !== Object(o))
    throw new TypeError('Object.keys called on non-object');
  var ret = [];
  for (var p in o)
    if(Object.prototype.hasOwnProperty.call(o, p))
      ret.push(p);
  return ret;
}

// the following are implemented in the same way:

if (!Object.values) Object.values = function Object_values(o) {
  if (o !== Object(o))
    throw new TypeError('Object.values called on non-object');
  var ret = [];
  for (var p in o)
    if(Object.prototype.hasOwnProperty.call(o, p))
      ret.push(o[p]);
  return ret;
}

if (!Object.keyValuePairs) Object.keyValuePairs = function Object_keyValuePairs(o) {
  if (o !== Object(o))
    throw new TypeError('Object.keyValuePairs called on non-object');
  var ret = [];
  for (var p in o)
    if(Object.prototype.hasOwnProperty.call(o, p))
      ret.push([p, o[p]]);
  return ret;
}

if (!Object.clone) Object.clone = function Object_clone(o) {
  var ret = {};
  var kvpairs = Object.keyValuePairs(o); // throws
  for (var i in kvpairs)
    ret[kvpairs[i][0]] = kvpairs[i][1];
  return ret;
}

if (!String.prototype.escapeContent) String.prototype.escapeContent = function String_escapeContent() {
  return this.replace(/&/g, "&amp;")
             .replace(/</g, "&lt;");
}

if (!String.prototype.escapeAttribute) String.prototype.escapeAttribute = function String_escapeAttribute() {
  return this.escapeContent()
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&apos;");
}

if (!String.prototype.trim) String.prototype.trim = function String_trim() {
  var x = this;
  x = x.replace(/^\s*(.*?)/, "$1");
  x = x.replace(/(.*?)\s*$/, "$1");
  return x;
}

if (!Number.prototype.pad) Number.prototype.pad = function Number_pad(positions) {
  var divisor = Math.pow(10, (positions || 2) - 1);
  var ret = "";
  while (this < divisor && divisor > 1) {
    ret+= "0";
    divisor/= 10;
  }
  return ret + this;
}

// Fallbacks for localStorage:
try {
  storage = window.localStorage;
} catch (e) {}
if (!storage) {
  try {
    if (window.globalStorage)
      storage = globalStorage[location.host];
  } catch (e) {}
}
storage = storage || {};

