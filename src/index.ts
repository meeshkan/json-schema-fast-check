import * as t from "io-ts";
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
  JSSTSimpleInteger,
  JSSTListTopLevel
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

interface Check<T> {
  c: t.Type<T, T>;
  f: (t: T) => fc.Arbitrary<any>;
}

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

const handleDefinitions = <T>(
  d: JSSTTopLevel<T>,
  options: JSSTOptions,
  check: Check<T>,
  tie: (s: string) => fc.Arbitrary<any>
): Record<string, fc.Arbitrary<any>> =>
  Object.entries(d)
    .map(([a, b]) => ({ [a]: processor<T>(b, false, options, d, check, tie) }))
    .reduce((a, b) => ({ ...a, ...b }), {});

const handleList = <T>(
  a: JSSTList<T>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T>,
  check: Check<T>,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  (a.uniqueItems ? fc.set : fc.array)(
    processor<T>(a.items, false, options, definitions, check, tie),
    typeof a.minItems === "number" ? a.minItems : 0,
    typeof a.maxItems === "number" ? a.maxItems : 0
  );

const __MAIN__ = "__%@M4!N_$__";

// TODO: use generics to combine toplevel functions
const handleTopLevelList = <T>(
  a: JSSTListTopLevel<T>,
  options: JSSTOptions,
  check: Check<T>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions<T>(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleList<T>(a, options, a.definitions || {}, check, tie)
  }))[__MAIN__];

const handleTuple = <T>(
  a: JSSTTuple<T>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T>,
  check: Check<T>,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  handleTupleInternal(
    a.items.map(i => processor(i, false, options, definitions, check, tie))
  );

// TODO: use generics to combine toplevel functions
const handleTopLevelTuple = <T>(
  a: JSSTTupleTopLevel<T>,
  options: JSSTOptions,
  check: Check<T>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleTuple(a, options, a.definitions || {}, check, tie)
  }))[__MAIN__];

const makePowerObject = <Q>(
  properties: Record<string, Q>,
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

const handleObjectInternal = <T>(
  properties: Record<string, JSSTAnything<T>>,
  required: string[],
  additionalProperties: Record<string, fc.Arbitrary<any>>,
  patternProperties: Record<string, fc.Arbitrary<any>>,
  dependencies: Record<string, Array<string>>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T>,
  check: Check<T>,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.oneof(
    ...makePowerObject(
      Object.entries(properties)
        .map(([a, b]) => ({
          [a]: processor(b, false, options, definitions, check, tie)
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

const handleObject = <T>(
  a: JSSTObject<T>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T>,
  check: Check<T>,
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
            processor(
              a.additionalProperties,
              false,
              options,
              definitions,
              check,
              tie
            )
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
                  processor(r, false, options, definitions, check, tie)
                )
              }))
              .reduce((q, r) => ({ ...q, ...r }), {})
          )
        }
      : {},
    a.dependencies || {},
    options,
    definitions,
    check,
    tie
  );

const handleTopLevelObject = <T>(
  a: JSSTObjectTopLevel<T>,
  options: JSSTOptions,
  check: Check<T>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions<T>(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleObject<T>(a, options, a.definitions || {}, check, tie)
  }))[__MAIN__];

const listOfChoices = <T>(check: Check<T>, a: JSSTAnyOf<T> | JSSTOneOf<T>) =>
  JSSTAnyOf(check.c).is(a) ? a.anyOf : a.oneOf;

const handleAnyOfOrOneOf = <T>(
  a: JSSTAnyOf<T> | JSSTOneOf<T>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T>,
  check: Check<T>,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.oneof(
    ...listOfChoices<T>(check, a).map(i =>
      processor(i, false, options, definitions, check, tie)
    )
  );

const handleTopLevelAnyOfOrOneOf = <T>(
  a: JSSTAnyOfTopLevel<T> | JSSTOneOfTopLevel<T>,
  options: JSSTOptions,
  check: Check<T>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions<T>(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleAnyOfOrOneOf<T>(
      a,
      options,
      a.definitions || {},
      check,
      tie
    )
  }))[__MAIN__];

const handleAllOf = <T>(
  a: JSSTAllOf<T>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T>,
  check: Check<T>,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.record({
    [options.allOfKey]: fc.record(
      a.allOf
        .map(i => ({
          [uuid4()]: processor(i, false, options, definitions, check, tie)
        }))
        .reduce((a, b) => ({ ...a, ...b }), {})
    )
  });

const handleTopLevelAllOf = <T>(
  a: JSSTAllOfTopLevel<T>,
  options: JSSTOptions,
  check: Check<T>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleAllOf(a, options, a.definitions || {}, check, tie)
  }))[__MAIN__];

const handleNot = <T>(a: JSSTNot<T>, definitions: JSSTTopLevel<T>) =>
  fc
    .anything()
    .filter(i => !jsonschema.validate(i, { ...a.not, definitions }).valid);

const handleTopLevelNot = <T>(a: JSSTNotTopLevel<T>): fc.Arbitrary<any> =>
  handleNot<T>(a, a.definitions || {});

const processor = <T>(
  jso: JSONSchemaObject<T>,
  toplevel: boolean,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T>,
  check: Check<T>,
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
    : toplevel && JSSTListTopLevel(check.c).is(jso)
    ? handleTopLevelList(jso, options, check)
    : toplevel && JSSTTupleTopLevel(check.c).is(jso)
    ? handleTopLevelTuple(jso, options, check)
    : toplevel && JSSTObjectTopLevel(check.c).is(jso)
    ? handleTopLevelObject(jso, options, check)
    : toplevel && JSSTAnyOfTopLevel(check.c).is(jso)
    ? handleTopLevelAnyOfOrOneOf(jso, options, check)
    : toplevel && JSSTOneOfTopLevel(check.c).is(jso)
    ? handleTopLevelAnyOfOrOneOf(jso, options, check)
    : toplevel && JSSTAllOfTopLevel(check.c).is(jso)
    ? handleTopLevelAllOf(jso, options, check)
    : toplevel && JSSTNotTopLevel(check.c).is(jso)
    ? handleTopLevelNot(jso)
    : JSSTList(check.c).is(jso)
    ? handleList(jso, options, definitions, check, tie)
    : JSSTTuple(check.c).is(jso)
    ? handleTuple(jso, options, definitions, check, tie)
    : JSSTObject(check.c).is(jso)
    ? handleObject(jso, options, definitions, check, tie)
    : JSSTAnyOf(check.c).is(jso)
    ? handleAnyOfOrOneOf(jso, options, definitions, check, tie)
    : JSSTOneOf(check.c).is(jso)
    ? handleAnyOfOrOneOf(jso, options, definitions, check, tie)
    : JSSTNot(check.c).is(jso)
    ? handleNot(jso, definitions)
    : JSSTAllOf(check.c).is(jso)
    ? handleAllOf(jso, options, definitions, check, tie)
    : JSSTEmpty.is(jso)
    ? fc.anything()
    : check.c.is(jso)
    ? check.f(jso)
    : (() => {
        throw Error("Have no clue how to process this." + JSON.stringify(jso));
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

const internalDefault = <T>(
  jso: JSONSchemaObject<T>,
  options: JSSTOptions,
  check: Check<T>
) =>
  processor(jso, true, options, {}, check, (s: string) => fc.integer()).map(i =>
    makeHoist(options)(i)
  );

export const makeArbitrary = <T>(
  jso: JSONSchemaObject<T>,
  check: Check<T>,
  options?: Partial<JSSTOptions>
) =>
  internalDefault(
    jso,
    { ...DEFAULT_OPTIONS, ...(options ? options : {}) },
    check
  );
const fcType = new t.Type<fc.Arbitrary<any>, fc.Arbitrary<any>>(
  "fast-check",
  (input: unknown): input is fc.Arbitrary<any> => input instanceof fc.Arbitrary,
  (input, context) =>
    input instanceof fc.Arbitrary
      ? t.success(input)
      : t.failure(input, context),
  t.identity
);

export const generateT = <T>(
  jso: JSONSchemaObject<T>,
  check: Check<T>,
  options?: Partial<JSSTOptions>
) => fc.sample(makeArbitrary(jso, check, options))[0];

export const generate = (
  jso: JSONSchemaObject<fc.Arbitrary<any>>,
  options?: Partial<JSSTOptions>
) => fc.sample(makeArbitrary(jso, { c: fcType, f: i => i }, options))[0];

export type FastCheckSchema = JSONSchemaObject<fc.Arbitrary<any>>;

export default (
  jso: JSONSchemaObject<fc.Arbitrary<any>>,
  options?: Partial<JSSTOptions>
) => makeArbitrary(jso, { c: fcType, f: i => i }, options);
