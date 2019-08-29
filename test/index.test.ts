import jsfc from "../src";
import fc from "fast-check";
import jsonschema from "jsonschema";
import { JSONSchemaObject } from "../src/generated/json-schema-strict";

const validate = (schema: JSONSchemaObject) => {
  const { arbitrary, hoister } = jsfc(schema);
  fc.assert(
    fc.property(arbitrary, i => jsonschema.validate(hoister(i), schema).valid)
  );
};

test("integer is correctly defined", () => {
  const schema = { type: "integer" };
  expect(jsonschema.validate(42, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("integer is correctly defined with minimum", () => {
  const schema = { type: "integer", minimum: -42 };
  expect(jsonschema.validate(0, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("integer is correctly defined with maximum", () => {
  const schema = { type: "integer", maximum: 43 };
  expect(jsonschema.validate(0, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("integer is correctly defined with min/max", () => {
  const schema = { type: "integer", minimum: -1, maximum: 43 };
  expect(jsonschema.validate(0, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("integer is correctly defined with exclusive min/max", () => {
  const schema = {
    type: "integer",
    minimum: 0,
    maximum: 3,
    exclusiveMinimum: true,
    exclusiveMaximum: true
  };
  expect(jsonschema.validate(1, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("number is correctly defined", () => {
  const schema = { type: "number" };
  expect(jsonschema.validate(0.0, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("number is correctly defined with minimum", () => {
  const schema = { type: "number", minimum: -42 };
  expect(jsonschema.validate(0.0, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("number is correctly defined with maximum", () => {
  const schema = { type: "number", maximum: 43 };
  expect(jsonschema.validate(0.0, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("number is correctly defined with min/max", () => {
  const schema = { type: "number", minimum: -1, maximum: 43 };
  expect(jsonschema.validate(0.0, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("string is correctly defined", () => {
  const schema = { type: "string" };
  expect(jsonschema.validate("foo", schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("faker string is correctly defined", () => {
  const schema = { type: "string", faker: "address.zipCode" };
  expect(jsonschema.validate("foo", schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("array is correctly defined", () => {
  const schema = { type: "array", items: { type: "string" } };
  expect(jsonschema.validate(["foo", "bar"], schema).valid).toBe(true);
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
  expect(
    jsonschema.validate({ foo: "a", bar: 0.0, fewfwef: { a: 1 } }, schema).valid
  ).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("object with no additional properties is correctly defined", () => {
  const schema = {
    type: "object",
    properties: {
      foo: { type: "string" },
      bar: { type: "number" }
    },
    additionalProperties: false
  };
  expect(jsonschema.validate({ foo: "a", bar: 0.0 }, schema).valid).toBe(true);
  expect(
    jsonschema.validate({ foo: "a", bar: 0.0, fewfwef: { a: 1 } }, schema).valid
  ).toBe(false);
  validate(schema as JSONSchemaObject);
});

test("object with required properties and no additional properties is correctly defined", () => {
  const schema = {
    type: "object",
    required: ["foo"],
    properties: {
      foo: { type: "string" },
      bar: { type: "number" },
      baz: { type: "integer" }
    },
    additionalProperties: false
  };
  expect(jsonschema.validate({ foo: "a", bar: 0.0 }, schema).valid).toBe(true);
  expect(jsonschema.validate({ bar: 0.0 }, schema).valid).toBe(false);
  validate(schema as JSONSchemaObject);
});

test("$ref works", () => {
  const schema = {
    definitions: {
      baz: {
        type: "string"
      }
    },
    type: "object",
    properties: {
      foo: { $ref: "#/definitions/baz" },
      bar: { type: "number" }
    }
  };
  expect(jsonschema.validate({ foo: "a", bar: 0.0 }, schema).valid).toBe(true);
  validate(schema as JSONSchemaObject);
});

test("object with additional properties is correctly defined", () => {
  const schema = {
    type: "object",
    properties: {
      foo: { type: "string" }
    },
    additionalProperties: {
      type: "number"
    }
  };
  expect(jsonschema.validate({ foo: "a", baz: 0.0 }, schema).valid).toBe(true);
  expect(jsonschema.validate({ foo: "a", baz: "z" }, schema).valid).toBe(false);
  validate(schema as JSONSchemaObject);
});

test("object with pattern properties is correctly defined", () => {
  const schema = {
    type: "object",
    properties: {
      foo: { type: "string" }
    },
    patternProperties: {
      "^S_": { type: "string" },
      "^I_": { type: "integer" }
    }
  };
  expect(jsonschema.validate({ foo: "a", S_: "m" }, schema).valid).toBe(true);
  expect(
    jsonschema.validate({ foo: "a", S_z: "m", I_oo: 1 }, schema).valid
  ).toBe(true);
  expect(jsonschema.validate({ foo: "a", S_o: 1 }, schema).valid).toBe(false);
  validate(schema as JSONSchemaObject);
});
