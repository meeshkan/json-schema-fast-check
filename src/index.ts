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
import uuid4 from "uuid/v4";

interface JSFCOptions {
  patternPropertiesKey: string;
  additionalPropertiesKey: string;
}

// TODO: implement multipleOf
const handleInteger = (i: JSFCInteger) => {
  const minint = -2147483648;
  const maxint = 2147483647;
  return fc.integer(
    i.minimum ? i.minimum : minint,
    i.maximum ? i.maximum : maxint
  );
};

// TODO: implement multipleOf
const handleNumber = (n: JSFCNumber) => {
  const minnumber = 0.0;
  const maxnumber = 1.0;
  return fc.double(
    n.minimum ? n.minimum : minnumber,
    n.maximum ? n.maximum : maxnumber
  );
};

const handleString = (s: JSFCString) => fc.string();

const handleReference = (
  r: JSFCReference,
  toplevel: JSONSchemaObject,
  options: JSFCOptions
): fc.Arbitrary<any> =>
  JSFCObject.is(toplevel) &&
  toplevel.definitions &&
  toplevel.definitions[r.$ref.split("/")[2]]
    ? processor(toplevel.definitions[r.$ref.split("/")[2]], toplevel, options)
    : (() => {
        throw Error("wtf?");
      })();

const handleArray = (
  a: JSFCArray,
  toplevel: JSONSchemaObject,
  options: JSFCOptions
): fc.Arbitrary<any> => fc.array(processor(a.items, toplevel, options));

const handleObject = (
  a: JSFCObject,
  toplevel: JSONSchemaObject,
  options: JSFCOptions
): fc.Arbitrary<any> =>
  fc.record(
    Object.entries(a.properties ? a.properties : {})
      .map(([a, b]) => ({ [a]: processor(b, toplevel, options) }))
      .reduce((a, b) => ({ ...a, ...b }), {})
  );

const processor = (
  jso: JSONSchemaObject,
  toplevel: JSONSchemaObject,
  options: JSFCOptions
): fc.Arbitrary<any> =>
  JSFCInteger.is(jso)
    ? handleInteger(jso)
    : JSFCNumber.is(jso)
    ? handleNumber(jso)
    : JSFCString.is(jso)
    ? handleString(jso)
    : JSFCReference.is(jso)
    ? handleReference(jso, toplevel, options)
    : JSFCArray.is(jso)
    ? handleArray(jso, toplevel, options)
    : JSFCObject.is(jso)
    ? handleObject(jso, toplevel, options)
    : (() => {
        throw Error("wtf?");
      })();

const DEFAULT_OPTIONS = {
  patternPropertiesKey: uuid4(),
  additionalPropertiesKey: uuid4()
};

const hoist = (i: any, k: string) => ({
  ...Object.entries(i)
    .filter(([a]) => a !== k)
    .reduce((a, [b, c]) => ({ ...a, ...{ [b]: c } }), {}),
  ...(Object.keys(i).indexOf(k) !== -1 ? i[k] : {})
});

const makeHoist = ({
  additionalPropertiesKey,
  patternPropertiesKey
}: JSFCOptions) => {
  const ret = (i: any): any =>
    i instanceof Array
      ? i.map(a => ret(a))
      : typeof i === "object"
      ? hoist(hoist(i, additionalPropertiesKey), patternPropertiesKey)
      : i;
  return ret;
};

export default (jso: JSONSchemaObject, options?: Partial<JSFCOptions>) => {
  const opts = { ...DEFAULT_OPTIONS, ...(options ? options : {}) };
  return {
    arbitrary: processor(jso, jso, opts),
    hoister: makeHoist(opts)
  };
};
