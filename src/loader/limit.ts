/** Runs at most `n` of the given tasks at the same time, in the order they arrive. */
export function limit(n: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (running >= n) return;
    const start = queue.shift();
    if (start) {
      running++;
      start();
    }
  };
  return task =>
    new Promise((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            running--;
            next();
          });
      });
      next();
    });
}
