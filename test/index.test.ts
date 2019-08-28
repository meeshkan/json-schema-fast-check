import jsfc from "../src";
import fc from "fast-check";
import jsonschema from "jsonschema";
import { JSONSchemaObject } from "../src/generated/json-schema-strict";

const validate = (schema: JSONSchemaObject) =>
  fc.assert(fc.property(jsfc(schema as JSONSchemaObject), (i) => 
    jsonschema.validate(i, schema).valid
  ));

test("integer is correctly defined", () => {
  const schema = { type: "integer" };
  validate(schema as JSONSchemaObject);
});

test("integer is correctly defined with minimum", () => {
  const schema = { type: "integer", minimum: -42 };
  validate(schema as JSONSchemaObject);
});

test("integer is correctly defined with maximum", () => {
  const schema = { type: "integer", maximum: 43 };
  validate(schema as JSONSchemaObject);
});

test("integer is correctly defined with min/max", () => {
  const schema = { type: "integer", minimum: -1, maximum: 43 };
  validate(schema as JSONSchemaObject);
});

test("number is correctly defined", () => {
  const schema = { type: "number" };
  validate(schema as JSONSchemaObject);
});

test("number is correctly defined with minimum", () => {
  const schema = { type: "number", minimum: -42 };
  validate(schema as JSONSchemaObject);
});

test("number is correctly defined with maximum", () => {
  const schema = { type: "number", maximum: 43 };
  validate(schema as JSONSchemaObject);
});

test("number is correctly defined with min/max", () => {
  const schema = { type: "number", minimum: -1, maximum: 43 };
  validate(schema as JSONSchemaObject);
});

test("string is correctly defined", () => {
  const schema = { type: "string" };
  validate(schema as JSONSchemaObject);
});

test("array is correctly defined", () => {
  const schema = { type: "array", items: { type: "string" }};
  validate(schema as JSONSchemaObject);
});

test("object is correctly defined", () => {
  const schema = {
    type: "object",
    properties: {
      foo: { type: "string" },
      bar: { type: "number" }
    }
  };
  validate(schema as JSONSchemaObject);
});