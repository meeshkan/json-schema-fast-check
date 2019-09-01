import {
  JSONSchemaObject,
  JSSTInteger,
  JSSTNumber,
  JSSTSimpleString,
  JSSTArray,
  JSSTObject,
  JSSTReference,
  JSSTArrayTopLevel,
  JSSTTopLevel,
  JSSTObjectTopLevel,
  JSSTAnything,
  JSSTEmpty,
  JSSTRegex,
  JSSTOneOfTopLevel,
  JSSTAnyOfTopLevel,
  JSSTAnyOf,
  JSSTOneOf,
  JSSTNotTopLevel,
  JSSTNot,
  JSSTAllOfTopLevel,
  JSSTAllOf,
  JSSTBoolean,
  JSSTTuple,
  JSSTTupleTopLevel,
  JSSTNull,
  JSSTConst,
  JSSTIntegerEnum,
  JSSTNumberEnum,
  JSSTStringEnum,
  JSSTList,
  JSSTIntegerWithMinimum,
  JSSTIntegerWithNumericExclusiveMaximumAndMinimum,
  JSSTIntegerWithNumericExclusiveMinimumAndMaximum,
  JSSTIntegerWithMaximum,
  JSSTIntegerWithBounds,
  JSSTIntegerWithNumericExclusiveMinimum,
  JSSTIntegerWithNumericExclusiveBounds,
  JSSTIntegerWithNumericExclusiveMaximum,
  JSSTSimpleNumber,
  JSSTSimpleInteger
} from "json-schema-strictly-typed";
import fc from "fast-check";
import uuid4 from "uuid/v4";
import RandExp from "randexp";
import { Y } from "variadic-y";
import { integer, MersenneTwister19937 } from "random-js";
import power from "./power";
import handleTupleInternal from "./handleTupleInternal";
import faker from "faker";
import iso from "is-subset-of";
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

interface JSSTOptions {
  patternPropertiesKey: string;
  additionalPropertiesKey: string;
  allOfKey: string;
}

const handleInteger = (i: JSSTSimpleInteger) =>
  fc
    .integer(
      (JSSTIntegerWithMinimum.is(i) ||
      JSSTIntegerWithBounds.is(i) ||
      JSSTIntegerWithNumericExclusiveMaximumAndMinimum.is(i)
        ? i.minimum
        : JSSTIntegerWithNumericExclusiveMinimum.is(i) ||
          JSSTIntegerWithNumericExclusiveBounds.is(i)
        ? i.exclusiveMinimum + 1
        : -2147483648) +
        ((JSSTIntegerWithMinimum.is(i) ||
          JSSTIntegerWithNumericExclusiveMaximumAndMinimum.is(i)) &&
        i.exclusiveMinimum
          ? 1
          : 0),
      (JSSTIntegerWithMaximum.is(i) ||
      JSSTIntegerWithBounds.is(i) ||
      JSSTIntegerWithNumericExclusiveMinimumAndMaximum.is(i)
        ? i.maximum
        : JSSTIntegerWithNumericExclusiveMaximum.is(i) ||
          JSSTIntegerWithNumericExclusiveBounds.is(i)
        ? i.exclusiveMaximum - 1
        : 2147483647) -
        ((JSSTIntegerWithMaximum.is(i) ||
          JSSTIntegerWithNumericExclusiveMinimumAndMaximum.is(i)) &&
        i.exclusiveMaximum
          ? 1
          : 0)
    )
    .filter(x =>
      i.multipleOf ? Math.floor(x / i.multipleOf) === x / i.multipleOf : true
    );

const handleIntegerEnum = (i: JSSTIntegerEnum) =>
  fc.oneof(...i.enum.map(a => fc.constant(a)));

const handleStringEnum = (i: JSSTStringEnum) =>
  fc.oneof(...i.enum.map(a => fc.constant(a)));

const handleNumberEnum = (i: JSSTNumberEnum) =>
  fc.oneof(...i.enum.map(a => fc.constant(a)));

const handleNumber = (n: JSSTSimpleNumber) =>
  fc
    .double(
      typeof n.minimum === "number" ? n.minimum : 0.0,
      typeof n.maximum === "number" ? n.maximum : 1.0
    )
    .filter(x =>
      n.multipleOf ? Math.floor(x / n.multipleOf) === x / n.multipleOf : true
    );

const handleBoolean = () => fc.boolean();

const handleNull = () => fc.constant(null);

const handleConst = (c: JSSTConst) => fc.constant(c.const);

const BIG = 42;
const makeFakeStuff = (fkr: string) =>
  fc.oneof(
    ...[...Array(BIG).keys()].map(i =>
      fc.constant(`${(faker as any)[fkr.split(".")[0]][fkr.split(".")[1]]()}`)
    )
  );

const handleString = (s: JSSTSimpleString) =>
  s.faker ? makeFakeStuff(s.faker) : fc.string();

const handleRegex = (s: JSSTRegex) => rex(s.pattern);

const handleReference = (
  r: JSSTReference,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> => tie(r.$ref.split("/")[2]);

const handleDefinitions = (
  d: JSSTTopLevel,
  options: JSSTOptions,
  tie: (s: string) => fc.Arbitrary<any>
): Record<string, fc.Arbitrary<any>> =>
  Object.entries(d)
    .map(([a, b]) => ({ [a]: processor(b, false, options, d, tie) }))
    .reduce((a, b) => ({ ...a, ...b }), {});

const handleList = (
  a: JSSTList,
  options: JSSTOptions,
  definitions: JSSTTopLevel,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  (a.uniqueItems ? fc.set : fc.array)(
    processor(a.items, false, options, definitions, tie),
    typeof a.minItems === "number" ? a.minItems : 0,
    typeof a.maxItems === "number" ? a.maxItems : 0
  );

const __MAIN__ = "__%@M4!N_$__";

// TODO: use generics to combine toplevel functions
const handleTopLevelArray = (
  a: JSSTArrayTopLevel,
  options: JSSTOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleList(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const handleTuple = (
  a: JSSTTuple,
  options: JSSTOptions,
  definitions: JSSTTopLevel,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  handleTupleInternal(
    a.items.map(i => processor(i, false, options, definitions, tie))
  );

// TODO: use generics to combine toplevel functions
const handleTopLevelTuple = (
  a: JSSTTupleTopLevel,
  options: JSSTOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleTuple(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const makePowerObject = <T>(
  properties: Record<string, T>,
  required: string[],
  dependencies: Record<string, Array<string>>
) =>
  power(Object.keys(properties).filter(i => required.indexOf(i) === -1))
    .filter(
      // filter to only use proper dependencies
      l =>
        l.filter(
          v => !dependencies[v] || iso(dependencies[v], l.concat(required))
        ).length === l.length
    )
    .map(p =>
      Object.keys(properties)
        .filter(i => required.indexOf(i) !== -1)
        .concat(p)
        .map(j => ({ [j]: properties[j] }))
        .reduce((a, b) => ({ ...a, ...b }), {})
    );

const handleObjectInternal = (
  properties: Record<string, JSSTAnything>,
  required: string[],
  additionalProperties: Record<string, fc.Arbitrary<any>>,
  patternProperties: Record<string, fc.Arbitrary<any>>,
  dependencies: Record<string, Array<string>>,
  options: JSSTOptions,
  definitions: JSSTTopLevel,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.oneof(
    ...makePowerObject(
      Object.entries(properties)
        .map(([a, b]) => ({
          [a]: processor(b, false, options, definitions, tie)
        }))
        .reduce((a, b) => ({ ...a, ...b }), {}),
      required,
      dependencies
    ).map(p =>
      fc.record({
        ...p,
        ...additionalProperties,
        ...patternProperties
      })
    )
  );

const handleObject = (
  a: JSSTObject,
  options: JSSTOptions,
  definitions: JSSTTopLevel,
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
    a.dependencies || {},
    options,
    definitions,
    tie
  );

const handleTopLevelObject = (
  a: JSSTObjectTopLevel,
  options: JSSTOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleObject(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const listOfChoices = (a: JSSTAnyOf | JSSTOneOf) =>
  JSSTAnyOf.is(a) ? a.anyOf : a.oneOf;

const handleAnyOfOrOneOf = (
  a: JSSTAnyOf | JSSTOneOf,
  options: JSSTOptions,
  definitions: JSSTTopLevel,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.oneof(
    ...listOfChoices(a).map(i => processor(i, false, options, definitions, tie))
  );

const handleTopLevelAnyOfOrOneOf = (
  a: JSSTAnyOfTopLevel | JSSTOneOfTopLevel,
  options: JSSTOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleAnyOfOrOneOf(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const handleAllOf = (
  a: JSSTAllOf,
  options: JSSTOptions,
  definitions: JSSTTopLevel,
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
  a: JSSTAllOfTopLevel,
  options: JSSTOptions
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, tie),
    [__MAIN__]: handleAllOf(a, options, a.definitions || {}, tie)
  }))[__MAIN__];

const handleNot = (a: JSSTNot, definitions: JSSTTopLevel) =>
  fc
    .anything()
    .filter(i => !jsonschema.validate(i, { ...a.not, definitions }).valid);

const handleTopLevelNot = (a: JSSTNotTopLevel): fc.Arbitrary<any> =>
  handleNot(a, a.definitions || {});

const processor = (
  jso: JSONSchemaObject,
  toplevel: boolean,
  options: JSSTOptions,
  definitions: JSSTTopLevel,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  JSSTIntegerEnum.is(jso)
    ? handleIntegerEnum(jso)
    : JSSTNumberEnum.is(jso)
    ? handleNumberEnum(jso)
    : JSSTStringEnum.is(jso)
    ? handleStringEnum(jso)
    : JSSTSimpleInteger.is(jso)
    ? handleInteger(jso)
    : JSSTSimpleNumber.is(jso)
    ? handleNumber(jso)
    : JSSTBoolean.is(jso)
    ? handleBoolean()
    : JSSTRegex.is(jso)
    ? handleRegex(jso)
    : JSSTSimpleString.is(jso)
    ? handleString(jso)
    : JSSTNull.is(jso)
    ? handleNull()
    : JSSTConst.is(jso)
    ? handleConst(jso)
    : JSSTReference.is(jso)
    ? handleReference(jso, tie)
    : toplevel && JSSTArrayTopLevel.is(jso)
    ? handleTopLevelArray(jso, options)
    : toplevel && JSSTTupleTopLevel.is(jso)
    ? handleTopLevelTuple(jso, options)
    : toplevel && JSSTObjectTopLevel.is(jso)
    ? handleTopLevelObject(jso, options)
    : toplevel && JSSTAnyOfTopLevel.is(jso)
    ? handleTopLevelAnyOfOrOneOf(jso, options)
    : toplevel && JSSTOneOfTopLevel.is(jso)
    ? handleTopLevelAnyOfOrOneOf(jso, options)
    : toplevel && JSSTAllOfTopLevel.is(jso)
    ? handleTopLevelAllOf(jso, options)
    : toplevel && JSSTNotTopLevel.is(jso)
    ? handleTopLevelNot(jso)
    : JSSTArray.is(jso)
    ? handleList(jso, options, definitions, tie)
    : JSSTTuple.is(jso)
    ? handleTuple(jso, options, definitions, tie)
    : JSSTObject.is(jso)
    ? handleObject(jso, options, definitions, tie)
    : JSSTAnyOf.is(jso)
    ? handleAnyOfOrOneOf(jso, options, definitions, tie)
    : JSSTOneOf.is(jso)
    ? handleAnyOfOrOneOf(jso, options, definitions, tie)
    : JSSTNot.is(jso)
    ? handleNot(jso, definitions)
    : JSSTAllOf.is(jso)
    ? handleAllOf(jso, options, definitions, tie)
    : JSSTEmpty.is(jso)
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
}: JSSTOptions) =>
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

const internalDefault = (jso: JSONSchemaObject, options: JSSTOptions) =>
  processor(jso, true, options, {}, (s: string) => fc.integer()).map(i =>
    makeHoist(options)(i)
  );

const makeArbitrary = (jso: JSONSchemaObject, options?: Partial<JSSTOptions>) =>
  internalDefault(jso, { ...DEFAULT_OPTIONS, ...(options ? options : {}) });

export const generate = (
  jso: JSONSchemaObject,
  options?: Partial<JSSTOptions>
) => fc.sample(makeArbitrary(jso, options))[0];

export default makeArbitrary;
