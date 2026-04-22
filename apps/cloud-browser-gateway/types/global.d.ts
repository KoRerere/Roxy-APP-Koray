declare var $t: (id: string, values?: Record<string, any>) => string

declare namespace NodeJS {
  interface Global {
    $t: typeof $t
  }
}

interface Window {
  $t: typeof $t
}
