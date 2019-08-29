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
  JSFCTopLevelObject,
  JSFCAnything,
  JSFCEmpty,
  JSFCRegex,
  JSFCTopLevelOneOf,
  JSFCTopLevelAnyOf,
  JSFCAnyOf,
  JSFCOneOf,
  JSFCTopLevelNot,
  JSFCNot,
  JSFCTopLevelAllOf,
  JSFCAllOf,
  JSFCBoolean
} from "./generated/json-schema-strict";
import fc from "fast-check";
import uuid4 from "uuid/v4";
import RandExp from "randexp";
import { Y } from "variadic-y";
import { integer, MersenneTwister19937 } from "random-js";
import power from "./power";
import faker from "faker";
import jsonschema from "jsonschema";

const makeRandExp = (r: RegExp, seed: number) => {
  const ret = new RandExp(r);
  ret.randInt = (from: number, to: number) => {
    const mt = MersenneTwister19937.seed(seed);
    return integer(from, to)(mt);
  };
  return ret;
};
const rex = (s: string) =>
  fc.integer().map(i => makeRandExp(new RegExp(s), i).gen());

interface JSFCOptions {
  patternPropertiesKey: string;
  additionalPropertiesKey: string;
  allOfKey: string;
}

// TODO: implement multipleOf
const handleInteger = (i: JSFCInteger) => {
  const minint = -2147483648;
  const maxint = 2147483647;
  return fc.integer(
    (typeof i.minimum === "number" ? i.minimum : minint) +
      (i.exclusiveMinimum ? 1 : 0),
    (typeof i.maximum === "number" ? i.maximum : maxint) -
      (i.exclusiveMaximum ? 1 : 0)
  );
};

// TODO: implement multipleOf
const handleNumber = (n: JSFCNumber) => {
  const minnumber = 0.0;
  const maxnumber = 1.0;
  return fc.double(
    typeof n.minimum === "number" ? n.minimum : minnumber,
    typeof n.maximum === "number" ? n.maximum : maxnumber
  );
};

const handleBoolean = () => fc.boolean();

const BIG = 42;
const makeFakeStuff = (fkr: string) =>
  fc.oneof(
    ...[...Array(BIG).keys()].map(i =>
      fc.constant(`${(faker as any)[fkr.split(".")[0]][fkr.split(".")[1]]()}`)
    )
  );

const handleString = (s: JSFCString) =>
  s.faker ? makeFakeStuff(s.faker) : fc.string();

const handleRegex = (s: JSFCRegex) => rex(s.pattern);

const handleReference = (
  r: JSFCReference,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> => tie(r.$ref.split("/")[2]);

const handleDefinitions = (
  d: JSFCDefinitions,
  options: JSFCOptions,
  tie: (s: string) => fc.Arbitrary<any>
): Record<string, fc.Arbitrary<any>> =>
  Object.entries(d)
    .map(([a, b]) => ({ [a]: processor(b, false, options, d, tie) }))
    .reduce((a, b) => ({ ...a, ...b }), {});

const handleArray = (
  a: JSFCArray,
  options: JSFCOptions,
  definitions: JSFCDefinitions,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  (a.uniqueItems ? fc.set : fc.array)(
    processor(a.items, false, options, definitions, tie),
    typeof a.minItems === "number" ? a.minItems : 0,
    typeof a.maxItems === "number" ? a.maxItems : 0,
  );

const __MAIN__ = "__%@M4!N_$__";

// TODO: use generics to combine toplevel functions
const handleTopLevelArray = (
  a: JSFCTopLevelArray,
  options: JSFCOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleArray(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const makePowerObject = <T>(
  properties: Record<string, T>,
  required: string[]
) =>
  power(Object.keys(properties).filter(i => required.indexOf(i) === -1)).map(
    p =>
      Object.keys(properties)
        .filter(i => required.indexOf(i) !== -1)
        .concat(p)
        .map(j => ({ [j]: properties[j] }))
        .reduce((a, b) => ({ ...a, ...b }), {})
  );

const handleObjectInternal = (
  properties: Record<string, JSFCAnything>,
  required: string[],
  additionalProperties: Record<string, fc.Arbitrary<any>>,
  patternProperties: Record<string, fc.Arbitrary<any>>,
  options: JSFCOptions,
  definitions: JSFCDefinitions,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.oneof(
    ...makePowerObject(
      Object.entries(properties)
        .map(([a, b]) => ({
          [a]: processor(b, false, options, definitions, tie)
        }))
        .reduce((a, b) => ({ ...a, ...b }), {}),
      required
    ).map(p =>
      fc.record({
        ...p,
        ...additionalProperties,
        ...patternProperties
      })
    )
  );

const handleObject = (
  a: JSFCObject,
  options: JSFCOptions,
  definitions: JSFCDefinitions,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  handleObjectInternal(
    a.properties || {},
    a.required || [],
    typeof a.additionalProperties === "boolean"
      ? a.additionalProperties
        ? {
            [options.additionalPropertiesKey]: fc.dictionary(
              fc.string(),
              fc.anything()
            )
          }
        : {}
      : a.additionalProperties
      ? {
          [options.additionalPropertiesKey]: fc.dictionary(
            fc.string(),
            processor(a.additionalProperties, false, options, definitions, tie)
          )
        }
      : {},
    a.patternProperties
      ? {
          [options.patternPropertiesKey]: fc.record(
            Object.entries(a.patternProperties)
              .map(([q, r]) => ({
                [q]: fc.dictionary(
                  rex(q),
                  processor(r, false, options, definitions, tie)
                )
              }))
              .reduce((q, r) => ({ ...q, ...r }), {})
          )
        }
      : {},
    options,
    definitions,
    tie
  );

const handleTopLevelObject = (
  a: JSFCTopLevelObject,
  options: JSFCOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleObject(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const listOfChoices = (a: JSFCAnyOf | JSFCOneOf) =>
  JSFCAnyOf.is(a) ? a.anyOf : a.oneOf;

const handleAnyOfOrOneOf = (
  a: JSFCAnyOf | JSFCOneOf,
  options: JSFCOptions,
  definitions: JSFCDefinitions,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.oneof(
    ...listOfChoices(a).map(i => processor(i, false, options, definitions, tie))
  );

const handleTopLevelAnyOfOrOneOf = (
  a: JSFCTopLevelAnyOf | JSFCTopLevelOneOf,
  options: JSFCOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleAnyOfOrOneOf(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const handleAllOf = (
  a: JSFCAllOf,
  options: JSFCOptions,
  definitions: JSFCDefinitions,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.record({
    [options.allOfKey]: fc.record(
      a.allOf
        .map(i => ({
          [uuid4()]: processor(i, false, options, definitions, tie)
        }))
        .reduce((a, b) => ({ ...a, ...b }), {})
    )
  });

const handleTopLevelAllOf = (
  a: JSFCTopLevelAllOf,
  options: JSFCOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleAllOf(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const handleNot = (a: JSFCNot, definitions: JSFCDefinitions) =>
  fc
    .anything()
    .filter(i => !jsonschema.validate(i, { ...a.not, definitions }).valid);

const handleTopLevelNot = (a: JSFCTopLevelNot): fc.Arbitrary<any> =>
  handleNot(a, a.definitions || {});

const processor = (
  jso: JSONSchemaObject,
  toplevel: boolean,
  options: JSFCOptions,
  definitions: JSFCDefinitions,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  JSFCInteger.is(jso)
    ? handleInteger(jso)
    : JSFCNumber.is(jso)
    ? handleNumber(jso)
    : JSFCBoolean.is(jso)
    ? handleBoolean()
    : JSFCRegex.is(jso)
    ? handleRegex(jso)
    : JSFCString.is(jso)
    ? handleString(jso)
    : JSFCReference.is(jso)
    ? handleReference(jso, tie)
    : toplevel && JSFCTopLevelArray.is(jso)
    ? handleTopLevelArray(jso, options)
    : toplevel && JSFCTopLevelObject.is(jso)
    ? handleTopLevelObject(jso, options)
    : toplevel && JSFCTopLevelAnyOf.is(jso)
    ? handleTopLevelAnyOfOrOneOf(jso, options)
    : toplevel && JSFCTopLevelOneOf.is(jso)
    ? handleTopLevelAnyOfOrOneOf(jso, options)
    : toplevel && JSFCTopLevelAllOf.is(jso)
    ? handleTopLevelAllOf(jso, options)
    : toplevel && JSFCTopLevelNot.is(jso)
    ? handleTopLevelNot(jso)
    : JSFCArray.is(jso)
    ? handleArray(jso, options, definitions, tie)
    : JSFCObject.is(jso)
    ? handleObject(jso, options, definitions, tie)
    : JSFCAnyOf.is(jso)
    ? handleAnyOfOrOneOf(jso, options, definitions, tie)
    : JSFCOneOf.is(jso)
    ? handleAnyOfOrOneOf(jso, options, definitions, tie)
    : JSFCNot.is(jso)
    ? handleNot(jso, definitions)
    : JSFCAllOf.is(jso)
    ? handleAllOf(jso, options, definitions, tie)
    : JSFCEmpty.is(jso)
    ? fc.anything()
    : (() => {
        throw Error("wtf? " + JSON.stringify(jso));
      })();

const DEFAULT_OPTIONS = {
  patternPropertiesKey: uuid4(),
  additionalPropertiesKey: uuid4(),
  allOfKey: uuid4()
};

const hoistBase = (i: any, k: string) => ({
  ...Object.entries(i)
    .filter(([a]) => a !== k)
    .reduce((a, [b, c]) => ({ ...a, ...{ [b]: c } }), {})
});

const hoist1L = (i: any, k: string) => ({
  ...hoistBase(i, k),
  ...(Object.keys(i).indexOf(k) !== -1 ? i[k] : {})
});

const hoist2L = (i: any, k: string) => ({
  ...hoistBase(i, k),
  ...(Object.keys(i).indexOf(k) !== -1
    ? Object.entries(i[k])
        .map(([_, b]) => b)
        .reduce((a, b) => ({ ...a, ...b }), {})
    : {})
});

const makeHoist = ({
  additionalPropertiesKey,
  patternPropertiesKey,
  allOfKey
}: JSFCOptions) =>
  Y((ret: (z: any) => any) => (i: any): any =>
    i === null
      ? i
      : i instanceof Array
      ? i.map(a => ret(a))
      : typeof i === "object"
      ? hoist2L(
          hoist2L(hoist1L(i, additionalPropertiesKey), patternPropertiesKey),
          allOfKey
        )
      : i
  );

const internalDefault = (jso: JSONSchemaObject, options: JSFCOptions) => ({
  arbitrary: processor(jso, true, options, {}, (s: string) => fc.integer()),
  hoister: makeHoist(options)
});

export default (jso: JSONSchemaObject, options?: Partial<JSFCOptions>) =>
  internalDefault(jso, { ...DEFAULT_OPTIONS, ...(options ? options : {}) });
