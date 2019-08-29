import fc from "fast-check";

export default (a: fc.Arbitrary<any>[]) =>
  a.length === 0
    ? fc.constant([])
    : a.length === 1
    ? fc.tuple(a[0])
    : a.length === 2
    ? fc.tuple(a[0], a[1])
    : a.length === 3
    ? fc.tuple(a[0], a[1], a[2])
    : a.length === 4
    ? fc.tuple(a[0], a[1], a[2], a[3])
    : a.length === 5
    ? fc.tuple(a[0], a[1], a[2], a[3], a[4])
    : a.length === 6
    ? fc.tuple(a[0], a[1], a[2], a[3], a[4], a[5])
    : a.length === 7
    ? fc.tuple(a[0], a[1], a[2], a[3], a[4], a[5], a[6])
    : a.length === 8
    ? fc.tuple(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7])
    : a.length === 9
    ? fc.tuple(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8])
    : a.length === 10
    ? fc.tuple(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9])
    : a.length === 11
    ? fc.tuple(
        a[0],
        a[1],
        a[2],
        a[3],
        a[4],
        a[5],
        a[6],
        a[7],
        a[8],
        a[9],
        a[10]
      )
    : a.length === 12
    ? fc.tuple(
        a[0],
        a[1],
        a[2],
        a[3],
        a[4],
        a[5],
        a[6],
        a[7],
        a[8],
        a[9],
        a[10],
        a[11]
      )
    : a.length === 13
    ? fc.tuple(
        a[0],
        a[1],
        a[2],
        a[3],
        a[4],
        a[5],
        a[6],
        a[7],
        a[8],
        a[9],
        a[10],
        a[11],
        a[12]
      )
    : a.length === 14
    ? fc.tuple(
        a[0],
        a[1],
        a[2],
        a[3],
        a[4],
        a[5],
        a[6],
        a[7],
        a[8],
        a[9],
        a[10],
        a[11],
        a[12],
        a[13]
      )
    : a.length === 15
    ? fc.tuple(
        a[0],
        a[1],
        a[2],
        a[3],
        a[4],
        a[5],
        a[6],
        a[7],
        a[8],
        a[9],
        a[10],
        a[11],
        a[12],
        a[13],
        a[14]
      )
    : a.length === 16 // TODO: go above 16?
    ? fc.tuple(
        a[0],
        a[1],
        a[2],
        a[3],
        a[4],
        a[5],
        a[6],
        a[7],
        a[8],
        a[9],
        a[10],
        a[11],
        a[12],
        a[13],
        a[14],
        a[15]
      )
    : fc.array(a[0]);
