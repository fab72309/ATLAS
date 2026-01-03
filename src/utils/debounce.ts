export type DebouncedFunction<T extends (...args: unknown[]) => void> = ((
  ...args: Parameters<T>
) => void) & {
  cancel: () => void;
  flush: () => void;
};

export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  waitMs: number
): DebouncedFunction<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (!lastArgs) return;
      const nextArgs = lastArgs;
      lastArgs = null;
      fn(...nextArgs);
    }, waitMs);
  }) as DebouncedFunction<T>;

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debounced.flush = () => {
    if (!timeoutId || !lastArgs) return;
    clearTimeout(timeoutId);
    timeoutId = null;
    const nextArgs = lastArgs;
    lastArgs = null;
    fn(...nextArgs);
  };

  return debounced;
};
