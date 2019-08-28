import * as t from "io-ts-codegen";
import fs from "fs";
import prettier from "prettier";
import mkdirp from "mkdirp";
import path from "path";
import yaml from "js-yaml";

interface NullSchema {
  type: "null";
}

interface StringSchema {
  type: "string";
}

interface IntegerSchema {
  type: "integer";
}

interface NumberSchema {
  type: "number";
}

interface BooleanSchema {
  type: "boolean";
}

interface ArraySchema {
  type: "array";
  items: JSONSchema;
}

interface ObjectSchema {
  type: "object";
  properties: { [key: string]: JSONSchema };
  required?: Array<string>;
  patternProperties?: { "^x-"?: {} };
}

interface PatternedRecordSchema {
  type: "object";
  patternProperties: { [key: string]: JSONSchema };
}

interface RecordSchema {
  type: "object";
  additionalProperties: JSONSchema;
}

interface AnyOfSchema {
  anyOf: JSONSchema[];
}

interface RefSchema {
  $ref: string;
}

interface ConstSchema {
  const: string;
}

interface EmptySchema {}

type JSONSchema =
  | NullSchema
  | StringSchema
  | RecordSchema
  | IntegerSchema
  | NumberSchema
  | BooleanSchema
  | ArraySchema
  | ObjectSchema
  | EmptySchema
  | RefSchema;

function getRequiredProperties(schema: ObjectSchema): { [key: string]: true } {
  const required: { [key: string]: true } = {};
  if (schema.required) {
    schema.required.forEach(function(k) {
      required[k] = true;
    });
  }
  return required;
}

function toInterfaceCombinator(
  schema: ObjectSchema
): t.InterfaceCombinator | t.BrandCombinator {
  const required = getRequiredProperties(schema);
  const out = t.interfaceCombinator(
    Object.keys(schema.properties).map(key =>
      t.property(key, to(schema.properties[key]), !required.hasOwnProperty(key))
    )
  );
  return out;
}

const isBoolean = (u: unknown): u is BooleanSchema =>
  u && typeof u === "object" && (<BooleanSchema>u).type === "boolean";

const isNumber = (u: unknown): u is NumberSchema =>
  u && typeof u === "object" && (<NumberSchema>u).type === "number";

const isInteger = (u: unknown): u is IntegerSchema =>
  u && typeof u === "object" && (<IntegerSchema>u).type === "integer";

const isNull = (u: unknown): u is IntegerSchema =>
  u && typeof u === "object" && (<NullSchema>u).type === "null";

const isArray = (u: unknown): u is ArraySchema =>
  u && typeof u === "object" && (<ArraySchema>u).type === "array";

const isRecord = (u: unknown): u is RecordSchema =>
  u &&
  typeof u === "object" &&
  (<ObjectSchema>u).properties === undefined &&
  typeof (<RecordSchema>u).additionalProperties === "object";

const isEmpty = (u: unknown): u is EmptySchema =>
  u && typeof u === "object" && Object.keys(<object>u).length === 0;

const isPatternedRecord = (u: unknown): u is PatternedRecordSchema =>
  u &&
  typeof u === "object" &&
  (<ObjectSchema>u).properties === undefined &&
  typeof (<PatternedRecordSchema>u).patternProperties === "object";

const isObject = (u: unknown): u is ObjectSchema =>
  u &&
  typeof u === "object" &&
  (<ObjectSchema>u).type === "object" &&
  (<ObjectSchema>u).properties !== undefined;

const isRef = (u: unknown): u is RefSchema =>
  u && typeof u === "object" && (<RefSchema>u).$ref !== undefined;

const isConst = (u: unknown): u is ConstSchema =>
  u && typeof u === "object" && (<ConstSchema>u).const !== undefined;


const isAnyOf = (u: unknown): u is AnyOfSchema =>
  u && typeof u === "object" && (<AnyOfSchema>u).anyOf !== undefined;

const to = (schema: JSONSchema): t.TypeReference =>
  isRef(schema)
    ? t.identifier(schema.$ref.split("/").slice(-1)[0])
    : isConst(schema)
    ? t.literalCombinator(schema.const)
    : isAnyOf(schema)
    ? t.unionCombinator(schema.anyOf.map(i => to(i)))
    : isRecord(schema)
    ? t.recordCombinator(t.stringType, to(schema.additionalProperties))
    : isObject(schema)
    ? toInterfaceCombinator(schema)
    : isPatternedRecord(schema)
    ? t.recordCombinator(
        t.stringType,
        to(Object.entries(schema.patternProperties).filter(
          ([a]) => a !== "^x-"
        )[0][1] as JSONSchema)
      )
    : isArray(schema)
    ? t.arrayCombinator(to(schema.items))
    : isNumber(schema)
    ? t.numberType
    : isInteger(schema)
    ? t.numberType // t.intType - because this causes weirdness in the types, we let go
    : isNull(schema)
    ? t.nullType
    : isBoolean(schema)
    ? t.booleanType
    : isEmpty(schema)
    ? t.arrayCombinator(t.identifier("L04$3"))
    : t.stringType; // no need for string schema

const generateTypes = ({
  input,
  output,
  toplevel
}: {
  input: any;
  output: string;
  toplevel: string;
}) => {
  mkdirp.sync(path.dirname(output));
  const full = yaml.load(fs.readFileSync(input).toString());
  const { definitions, ...fullObj } = full;
  const declarations = Object.entries(definitions)
    .map(([a, b]) => t.typeDeclaration(a, to(b as JSONSchema)))
    .concat(t.typeDeclaration(toplevel, to(fullObj as JSONSchema)));
  const sorted = t.sort(declarations);
  fs.writeFileSync(
    output,
    prettier.format(
      [
        `import * as t from "io-ts";
`
      ]
        .concat(sorted.map(d => `export ${t.printRuntime(d)}`))
        .concat(sorted.map(d => `export ${t.printStatic(d)}`))
        .join("\n"),
      {
        parser: "typescript"
      }
    )
  );
};

generateTypes({
  input: "./src/schema/json-schema-strict.yml",
  output: "./src/generated/json-schema-strict.ts",
  toplevel: "JSONSchemaObject"
});
