import {
  JSONSchemaObject,
  JSFCInteger,
  JSFCNumber,
  JSFCString,
  JSFCArray,
  JSFCObject,
  JSFCReference,
  JSFCTopLevelArray,
  JSFCDefinitions,
  JSFCTopLevelObject
} from "./generated/json-schema-strict";
import fc from "fast-check";
import uuid4 from "uuid/v4";
import RandExp from "randexp";
import { integer, MersenneTwister19937 } from "random-js";
// import powerSet from 'power-set-x';

const makeRandExp = (r: RegExp, seed: number) => {
  const ret = new RandExp(r);
  ret.randInt = (from: number, to: number) => {
    const mt = MersenneTwister19937.seed(seed);
    return integer(from, to)(mt);
  }
  return ret;
}
// const char = () => fc.integer(0x20, 0x7e).map(String.fromCharCode);
// const string = () => fc.array(fc.char()).map(arr => arr.join(''));

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
  toplevel: boolean,
  options: JSFCOptions,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  tie(r.$ref.split("/")[2])

const handleDefinitions = (
  d: JSFCDefinitions,
  options: JSFCOptions,
  tie: (s: string) => fc.Arbitrary<any>
): Record<string, fc.Arbitrary<any>> =>
  Object
    .entries(d)
    .map(([a, b]) => ({[a]: processor(b, false, options, tie)}))
    .reduce((a, b) => ({...a, ...b}), {});

const handleArray = (
  a: JSFCArray,
  options: JSFCOptions,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> => fc.array(processor(a.items, false, options, tie));

const __MAIN__ = "__%@M4!N_$__"

// TODO: use generics to combine toplevel functions
const handleTopLevelArray = (
  a: JSFCTopLevelArray,
  options: JSFCOptions
): fc.Arbitrary<any> => fc.letrec(tie => ({
  ...handleDefinitions(a.definitions || {}, options, tie),
  [__MAIN__]: handleArray(a, options, tie)
}))[__MAIN__];

const handleObject = (
  a: JSFCObject,
  options: JSFCOptions,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  fc.record(
    Object.entries(a.properties ? a.properties : {})
      .map(([a, b]) => ({ [a]: processor(b, false, options, tie) }))
      .reduce((a, b) => ({ ...a, ...b }), {})
  );

const handleTopLevelObject = (
  a: JSFCTopLevelObject,
  options: JSFCOptions
): fc.Arbitrary<any> => fc.letrec(tie => ({
  ...handleDefinitions(a.definitions || {}, options, tie),
  [__MAIN__]: handleObject(a, options, tie)
}))[__MAIN__];
  

const processor = (
  jso: JSONSchemaObject,
  toplevel: boolean,
  options: JSFCOptions,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  JSFCInteger.is(jso)
    ? handleInteger(jso)
    : JSFCNumber.is(jso)
    ? handleNumber(jso)
    : JSFCString.is(jso)
    ? handleString(jso)
    : JSFCReference.is(jso)
    ? handleReference(jso, false, options, tie)
    : toplevel && JSFCTopLevelArray.is(jso)
    ? handleTopLevelArray(jso, options)
    : toplevel && JSFCTopLevelObject.is(jso)
    ? handleTopLevelObject(jso, options)
    : JSFCArray.is(jso)
    ? handleArray(jso, options, tie)
    : JSFCObject.is(jso)
    ? handleObject(jso, options, tie)
    : (() => {
        throw Error("wtf? "+JSON.stringify(jso));
      })();

const DEFAULT_OPTIONS = {
  patternPropertiesKey: uuid4(),
  additionalPropertiesKey: uuid4()
};

const hoistBase = (i: any, k: string) => ({
  ...Object.entries(i)
    .filter(([a]) => a !== k)
    .reduce((a, [b, c]) => ({ ...a, ...{ [b]: c } }), {}),
});

const hoist1L = (i: any, k: string) => ({
  ...hoistBase(i, k),
  ...(Object.keys(i).indexOf(k) !== -1 ? i[k] : {})
});

const hoist2L = (i: any, k: string) => ({
  ...hoistBase(i, k),
  ...(Object.keys(i).indexOf(k) !== -1
      ? Object
        .entries(i)
        .map(([_, b]) => b)
        .reduce((a, b) => ({ ...a, ...b }), {})
      : {})
});

const makeHoist = ({
  additionalPropertiesKey,
  patternPropertiesKey
}: JSFCOptions) => {
  const ret = (i: any): any =>
    i instanceof Array
      ? i.map(a => ret(a))
      : typeof i === "object"
      ? hoist2L(hoist1L(i, additionalPropertiesKey), patternPropertiesKey)
      : i;
  return ret;
};

export default (jso: JSONSchemaObject, options?: Partial<JSFCOptions>) => {
  const opts = { ...DEFAULT_OPTIONS, ...(options ? options : {}) };
  // TODO: make seperate functions for toplevel to avoid the no-op
  const no_op_tie = (s: string) => fc.integer();
  return {
    arbitrary: processor(jso, true, opts, no_op_tie),
    hoister: makeHoist(opts)
  };
};
