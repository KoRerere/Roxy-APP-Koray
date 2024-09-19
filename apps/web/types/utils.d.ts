type Writable<T> = {
  -readonly [P in keyof T]: T[P];
}
type Recordable<T = any> = Record<string, T>

interface PromiseFn<T = any, R = T> {
  (...arg: T[]): Promise<R>
}

type Objectable<T extends object> = {
  [P in keyof T]: T[P];
} & Recordable
