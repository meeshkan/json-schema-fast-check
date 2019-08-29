const range = (n: number) => [...Array(n).keys()];

const helper = <T>(a: T[], base: number[][]) =>
  range(2 ** a.length).map(i =>
    base.filter(([j]) => (j & i) !== 0).map(([_, m]) => a[m])
  );

export default <T>(a: T[]) => helper(a, range(a.length).map(j => [2 ** j, j]));
