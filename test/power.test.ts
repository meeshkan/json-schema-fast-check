import power from "../src/power";
import fc from "fast-check";
import iso from "is-subset-of";

test("power set works", () => {
  const a = [1, 5, "foo"];
  expect(
    new Set([
      [],
      [1],
      [5],
      ["foo"],
      [1, 5],
      [1, "foo"],
      [5, "foo"],
      [1, 5, "foo"]
    ])
  ).toEqual(new Set(power(a)));
});

test("power set always works", () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), a => {
      const setA = new Set(a);
      const s = power(a).map(i => new Set(i));
      return (
        new Set(s).size === 2 ** a.length &&
        s.filter(i => !iso(i, setA)).length === 0
      );
    })
  );
});
