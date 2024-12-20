import { action, Err, Ok, type Operation, type Result, suspend } from "effection";

export interface WithResolvers<T> {
  operation: Operation<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

export function withResolvers<T>(): WithResolvers<T> {
  const subscribers: Set<Resolver<T>> = new Set();
  let settlement: Result<T> | undefined = undefined;
  const operation = action<T>(function* (resolve, reject) {
    const resolver = { resolve, reject };
    if (settlement) {
      notify(settlement, resolver);
    } else {
      try {
        subscribers.add(resolver);
        yield* suspend();
      } finally {
        subscribers.delete(resolver);
      }
    }
  });

  let settle = (result: Result<T>) => {
    if (!settlement) {
      settlement = result;
      settle = () => {};
    }
    for (const subscriber of subscribers) {
      subscribers.delete(subscriber);
      notify(settlement, subscriber);
    }
  };

  const resolve = (value: T) => {
    settle(Ok(value));
  };
  const reject = (error: Error) => {
    settle(Err(error));
  };

  return { operation, resolve, reject };
}

interface Resolver<T> {
  resolve(value: T): void;
  reject(error: Error): void;
}

function notify<T>(result: Result<T>, resolver: Resolver<T>): void {
  if (result.ok) {
    resolver.resolve(result.value);
  } else {
    if ("error" in result) {
      resolver.reject(result.error);
    } else {
      resolver.reject(new Error("unknown error"));
    }
  }
}
