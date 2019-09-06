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

interface Check<T, U extends object> {
  c: t.Type<T, T>;
  u: t.Type<U, U>;
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

const handleInteger = <U extends object>(qualifier: t.Type<U, U>) => (
  i: JSSTSimpleInteger<U>
) =>
  fc
    .integer(
      (JSSTIntegerWithMinimum(qualifier).is(i) ||
      JSSTIntegerWithBounds(qualifier).is(i) ||
      JSSTIntegerWithNumericExclusiveMaximumAndMinimum(qualifier).is(i)
        ? i.minimum
        : JSSTIntegerWithNumericExclusiveMinimum(qualifier).is(i) ||
          JSSTIntegerWithNumericExclusiveBounds(qualifier).is(i)
        ? i.exclusiveMinimum + 1
        : -2147483648) +
        ((JSSTIntegerWithMinimum(qualifier).is(i) ||
          JSSTIntegerWithNumericExclusiveMaximumAndMinimum(qualifier).is(i)) &&
        i.exclusiveMinimum
          ? 1
          : 0),
      (JSSTIntegerWithMaximum(qualifier).is(i) ||
      JSSTIntegerWithBounds(qualifier).is(i) ||
      JSSTIntegerWithNumericExclusiveMinimumAndMaximum(qualifier).is(i)
        ? i.maximum
        : JSSTIntegerWithNumericExclusiveMaximum(qualifier).is(i) ||
          JSSTIntegerWithNumericExclusiveBounds(qualifier).is(i)
        ? i.exclusiveMaximum - 1
        : 2147483647) -
        ((JSSTIntegerWithMaximum(qualifier).is(i) ||
          JSSTIntegerWithNumericExclusiveMinimumAndMaximum(qualifier).is(i)) &&
        i.exclusiveMaximum
          ? 1
          : 0)
    )
    .filter(x =>
      i.multipleOf ? Math.floor(x / i.multipleOf) === x / i.multipleOf : true
    );

const handleIntegerEnum = <U extends object>(i: JSSTIntegerEnum<U>) =>
  fc.oneof(...i.enum.map(a => fc.constant(a)));

const handleStringEnum = <U extends object>(i: JSSTStringEnum<U>) =>
  fc.oneof(...i.enum.map(a => fc.constant(a)));

const handleNumberEnum = <U extends object>(i: JSSTNumberEnum<U>) =>
  fc.oneof(...i.enum.map(a => fc.constant(a)));

const handleNumber = <U extends object>(n: JSSTSimpleNumber<U>) =>
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

const handleConst = <U extends object>(c: JSSTConst<U>) => fc.constant(c.const);

const BIG = 42;
const makeFakeStuff = (fkr: string) =>
  fc.oneof(
    ...[...Array(BIG).keys()].map(i =>
      fc.constant(`${(faker as any)[fkr.split(".")[0]][fkr.split(".")[1]]()}`)
    )
  );

const handleString = <U extends object>(s: JSSTSimpleString<U>) =>
  s.faker ? makeFakeStuff(s.faker) : fc.string();

const handleRegex = <U extends object>(s: JSSTRegex<U>) => rex(s.pattern);

const handleReference = <U extends object>(
  r: JSSTReference<U>,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> => tie(r.$ref.split("/")[2]);

const handleDefinitions = <T, U extends object>(
  d: JSSTTopLevel<T, U>,
  options: JSSTOptions,
  check: Check<T, U>,
  tie: (s: string) => fc.Arbitrary<any>
): Record<string, fc.Arbitrary<any>> =>
  Object.entries(d)
    .map(([a, b]) => ({
      [a]: processor<T, U>(b, false, options, d, check, tie)
    }))
    .reduce((a, b) => ({ ...a, ...b }), {});

const handleList = <T, U extends object>(
  a: JSSTList<T, U>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T, U>,
  check: Check<T, U>,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  (a.uniqueItems ? fc.set : fc.array)(
    processor<T, U>(a.items, false, options, definitions, check, tie),
    typeof a.minItems === "number" ? a.minItems : 0,
    typeof a.maxItems === "number" ? a.maxItems : 0
  );

const __MAIN__ = "__%@M4!N_$__";

// TODO: use generics to combine toplevel functions
const handleTopLevelList = <T, U extends object>(
  a: JSSTListTopLevel<T, U>,
  options: JSSTOptions,
  check: Check<T, U>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions<T, U>(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleList<T, U>(a, options, a.definitions || {}, check, tie)
  }))[__MAIN__];

const handleTuple = <T, U extends object>(
  a: JSSTTuple<T, U>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T, U>,
  check: Check<T, U>,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  handleTupleInternal(
    a.items.map(i => processor(i, false, options, definitions, check, tie))
  );

// TODO: use generics to combine toplevel functions
const handleTopLevelTuple = <T, U extends object>(
  a: JSSTTupleTopLevel<T, U>,
  options: JSSTOptions,
  check: Check<T, U>
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

const handleObjectInternal = <T, U extends object>(
  properties: Record<string, JSSTAnything<T, U>>,
  required: string[],
  additionalProperties: Record<string, fc.Arbitrary<any>>,
  patternProperties: Record<string, fc.Arbitrary<any>>,
  dependencies: Record<string, Array<string>>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T, U>,
  check: Check<T, U>,
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

const handleObject = <T, U extends object>(
  a: JSSTObject<T, U>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T, U>,
  check: Check<T, U>,
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

const handleTopLevelObject = <T, U extends object>(
  a: JSSTObjectTopLevel<T, U>,
  options: JSSTOptions,
  check: Check<T, U>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions<T, U>(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleObject<T, U>(a, options, a.definitions || {}, check, tie)
  }))[__MAIN__];

const listOfChoices = <T, U extends object>(
  check: Check<T, U>,
  a: JSSTAnyOf<T, U> | JSSTOneOf<T, U>
) => (JSSTAnyOf(check.c, check.u).is(a) ? a.anyOf : a.oneOf);

const handleAnyOfOrOneOf = <T, U extends object>(
  a: JSSTAnyOf<T, U> | JSSTOneOf<T, U>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T, U>,
  check: Check<T, U>,
  tie: (s: string) => fc.Arbitrary<any>
) =>
  fc.oneof(
    ...listOfChoices<T, U>(check, a).map(i =>
      processor(i, false, options, definitions, check, tie)
    )
  );

const handleTopLevelAnyOfOrOneOf = <T, U extends object>(
  a: JSSTAnyOfTopLevel<T, U> | JSSTOneOfTopLevel<T, U>,
  options: JSSTOptions,
  check: Check<T, U>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions<T, U>(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleAnyOfOrOneOf<T, U>(
      a,
      options,
      a.definitions || {},
      check,
      tie
    )
  }))[__MAIN__];

const handleAllOf = <T, U extends object>(
  a: JSSTAllOf<T, U>,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T, U>,
  check: Check<T, U>,
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

const handleTopLevelAllOf = <T, U extends object>(
  a: JSSTAllOfTopLevel<T, U>,
  options: JSSTOptions,
  check: Check<T, U>
): fc.Arbitrary<any> =>
  fc.letrec(tie => ({
    ...handleDefinitions(a.definitions || {}, options, check, tie),
    [__MAIN__]: handleAllOf(a, options, a.definitions || {}, check, tie)
  }))[__MAIN__];

const handleNot = <T, U extends object>(
  a: JSSTNot<T, U>,
  definitions: JSSTTopLevel<T, U>
) =>
  fc
    .anything()
    .filter(i => !jsonschema.validate(i, { ...a.not, definitions }).valid);

const handleTopLevelNot = <T, U extends object>(
  a: JSSTNotTopLevel<T, U>
): fc.Arbitrary<any> => handleNot<T, U>(a, a.definitions || {});

const processor = <T, U extends object>(
  jso: JSONSchemaObject<T, U>,
  toplevel: boolean,
  options: JSSTOptions,
  definitions: JSSTTopLevel<T, U>,
  check: Check<T, U>,
  tie: (s: string) => fc.Arbitrary<any>
): fc.Arbitrary<any> =>
  JSSTIntegerEnum(check.u).is(jso)
    ? handleIntegerEnum(jso)
    : JSSTNumberEnum(check.u).is(jso)
    ? handleNumberEnum(jso)
    : JSSTStringEnum(check.u).is(jso)
    ? handleStringEnum(jso)
    : JSSTSimpleInteger(check.u).is(jso)
    ? handleInteger(check.u)(jso)
    : JSSTSimpleNumber(check.u).is(jso)
    ? handleNumber(jso)
    : JSSTBoolean(check.u).is(jso)
    ? handleBoolean()
    : JSSTRegex(check.u).is(jso)
    ? handleRegex(jso)
    : JSSTSimpleString(check.u).is(jso)
    ? handleString(jso)
    : JSSTNull(check.u).is(jso)
    ? handleNull()
    : JSSTConst(check.u).is(jso)
    ? handleConst(jso)
    : JSSTReference(check.u).is(jso)
    ? handleReference(jso, tie)
    : toplevel && JSSTListTopLevel(check.c, check.u).is(jso)
    ? handleTopLevelList(jso, options, check)
    : toplevel && JSSTTupleTopLevel(check.c, check.u).is(jso)
    ? handleTopLevelTuple(jso, options, check)
    : toplevel && JSSTObjectTopLevel(check.c, check.u).is(jso)
    ? handleTopLevelObject(jso, options, check)
    : toplevel && JSSTAnyOfTopLevel(check.c, check.u).is(jso)
    ? handleTopLevelAnyOfOrOneOf(jso, options, check)
    : toplevel && JSSTOneOfTopLevel(check.c, check.u).is(jso)
    ? handleTopLevelAnyOfOrOneOf(jso, options, check)
    : toplevel && JSSTAllOfTopLevel(check.c, check.u).is(jso)
    ? handleTopLevelAllOf(jso, options, check)
    : toplevel && JSSTNotTopLevel(check.c, check.u).is(jso)
    ? handleTopLevelNot(jso)
    : JSSTList(check.c, check.u).is(jso)
    ? handleList(jso, options, definitions, check, tie)
    : JSSTTuple(check.c, check.u).is(jso)
    ? handleTuple(jso, options, definitions, check, tie)
    : JSSTObject(check.c, check.u).is(jso)
    ? handleObject(jso, options, definitions, check, tie)
    : JSSTAnyOf(check.c, check.u).is(jso)
    ? handleAnyOfOrOneOf(jso, options, definitions, check, tie)
    : JSSTOneOf(check.c, check.u).is(jso)
    ? handleAnyOfOrOneOf(jso, options, definitions, check, tie)
    : JSSTNot(check.c, check.u).is(jso)
    ? handleNot(jso, definitions)
    : JSSTAllOf(check.c, check.u).is(jso)
    ? handleAllOf(jso, options, definitions, check, tie)
    : JSSTEmpty(check.u).is(jso)
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

const internalDefault = <T, U extends object>(
  jso: JSONSchemaObject<T, U>,
  options: JSSTOptions,
  check: Check<T, U>
) =>
  processor(jso, true, options, {}, check, (s: string) => fc.integer()).map(i =>
    makeHoist(options)(i)
  );

export const makeArbitrary = <T, U extends object>(
  jso: JSONSchemaObject<T, U>,
  check: Check<T, U>,
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

export const generateT = <T, U extends object>(
  jso: JSONSchemaObject<T, U>,
  check: Check<T, U>,
  options?: Partial<JSSTOptions>
) => fc.sample(makeArbitrary(jso, check, options))[0];

export const generate = (
  jso: JSONSchemaObject<fc.Arbitrary<any>, {}>,
  options?: Partial<JSSTOptions>
) =>
  fc.sample(
    makeArbitrary(jso, { c: fcType, f: i => i, u: t.type({}) }, options)
  )[0];

export type FastCheckSchema_<U extends object> = JSONSchemaObject<
  fc.Arbitrary<any>,
  U
>;
export type FastCheckSchema = FastCheckSchema_<{}>;

export default (
  jso: JSONSchemaObject<fc.Arbitrary<any>, {}>,
  options?: Partial<JSSTOptions>
) => makeArbitrary(jso, { c: fcType, f: i => i, u: t.type({}) }, options);
