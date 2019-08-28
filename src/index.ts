import {
  JSONSchemaObject,
  JSFCInteger,
  JSFCNumber,
  JSFCString,
  JSFCArray,
  JSFCObject,
  JSFCReference
} from "./generated/json-schema-strict";
import fc from "fast-check";

// TODO: implement multipleOf
const handleInteger = (i: JSFCInteger) => {
  const minint = -2147483648;
  const maxint = 2147483647;
  return fc.integer(
    i.minimum ? i.minimum : minint,
    i.maximum ? i.maximum : maxint);
}

// TODO: implement multipleOf
const handleNumber = (n: JSFCNumber) => {
  const minnumber = 0.0;
  const maxnumber = 1.0;
  return fc.double(
    n.minimum ? n.minimum : minnumber,
    n.maximum ? n.maximum : maxnumber);
}

const handleString = (s: JSFCString) => fc.string();

const handleReference = (r: JSFCReference, toplevel: JSONSchemaObject): fc.Arbitrary<any> =>
  JSFCObject.is(toplevel)
    && toplevel.definitions
    && toplevel.definitions[r.$ref.split("/")[2]]
  ? processor(toplevel.definitions[r.$ref.split("/")[2]], toplevel)
  : (() => { throw Error("wtf?") })();

const handleArray = (a: JSFCArray, toplevel: JSONSchemaObject): fc.Arbitrary<any> =>
  fc.array(processor(a.items, toplevel));

const handleObject = (a: JSFCObject, toplevel: JSONSchemaObject): fc.Arbitrary<any> =>
  fc.record(
    Object
      .entries(a.properties ? a.properties : {})
      .map(([a, b]) => ({[a]: processor(b, toplevel)}))
      .reduce((a, b) => ({ ...a, ...b}), {}));

const processor = (jso: JSONSchemaObject, toplevel: JSONSchemaObject): fc.Arbitrary<any> =>
  JSFCInteger.is(jso)
  ? handleInteger(jso)
  : JSFCNumber.is(jso)
  ? handleNumber(jso)
  : JSFCString.is(jso)
  ? handleString(jso)
  : JSFCReference.is(jso)
  ? handleReference(jso, toplevel)
  : JSFCArray.is(jso)
  ? handleArray(jso, toplevel)
  : JSFCObject.is(jso)
  ? handleObject(jso, toplevel)
  : (() => { throw Error("wtf?") })();

export default (jso: JSONSchemaObject) => processor(jso, jso);