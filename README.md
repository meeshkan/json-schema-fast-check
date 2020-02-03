[![CircleCI](https://circleci.com/gh/unmock/json-schema-fast-check.svg?style=svg)](https://circleci.com/gh/unmock/json-schema-fast-check)
[![codecov](https://codecov.io/gh/unmock/json-schema-fast-check/branch/master/graph/badge.svg)](https://codecov.io/gh/unmock/json-schema-fast-check)

# json-schema-fast-check

[JSON Schema](https://json-schema.org) is a useful way to define input and output schemas.

Property testing is a useful way to make sure that a function behaves as expected with *any* valid input.

`json-schema-fast-check` implements arbitrary JSON Schema values using the [`fast-check`](https://github.com/dubzzz/fast-check) library for property testing.

## Example

```typescript
import jsfc from "json-schema-fast-check";
import fc from "fast-check";

const getAge = (data: any) =>
    typeof data === "object" && typeof data.age === "number"
    ? Math.floor(data.age)
    : null;

const userSchema = {
    type: "object",
    properties: {
        required: ["name", "id"],
        name: {
            type: "string"
        },
        age: {
            type: "integer",
            minimum: 0
        },
        id: {
            type: "integer"
        }
    }
}

test("my function yields positive age or null", () => {
    fc.assert(fc.property(jsfc(userSchema), user => {
        const age = getAge(user);
        return age === null || age >= 0;
    }));
});
```

## API

The API has only two functions - the default one (which we call `jsfc` just cuz) and a helper function called `generate`.

### `jsfc` (default)

```typescript
const arbitrary = jsfc(mySchema);
```

Creates a [`fast-check` arbitrary](https://github.com/dubzzz/fast-check/blob/master/documentation/1-Guides/Arbitraries.md) from valid JSON schema.

### `generate`

```typescript
const json = generate(mySchema);
```

Generates a single valid JSON object that conforms to the schema.

## A note on JSON Schema

The actual schema used here is not JSON Schema but rather a subset of JSON Schema called "The Subest of JSON Schema I Was Not Too Lazy To Define." I also added some `faker-js` sugar (see the tests).

## Contributing

Thanks for wanting to contribute! We will soon have a contributing page detaling how to contribute. Meanwhile, there are plenty of features that haven't been implemented yet. Please check out our [open issues](https://github.com/meeshkan/json-schema-fast-check/issues). We'd really appreciate your help!

Please note that this project is governed by the [Meeshkan Community Code of Conduct](https://github.com/meeshkan/code-of-conduct). By participating in this project, you agree to abide by its terms.
