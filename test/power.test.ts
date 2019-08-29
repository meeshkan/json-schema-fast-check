import power from "../src/power";

test("power set works 2", () => {
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
