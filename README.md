# json-schema-fast-check

JSON Schema is a useful way to define input and output schemas.

Property testing is a useful way to make sure that a test passes with arbitrary values conforming to a schema.

`json-schema-fast-check` implements arbitrary JSON Schema values using the `fast-check` library for property testing.

The library is in `0.0.0-pre-pre-alpha`. Not on NPM yet. Assume nothing works. Check out the tests to grok the general idea. Enjoy!

## A note on JSON Schema

The actual schema used here is not JSON Schema but rather a subset of JSON Schema called "The Subest of JSON Schema I Was Not Too Lazy To Define." I also added some `faker-js` sugar (see the tests).