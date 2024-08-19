import Store from 'electron-store'

interface StoreType {
  browserCacheRootDir: string
}

export const store = new Store<StoreType>()

// store.set('unicorn', '🦄')
// console.log(store.get('unicorn'))
// // => '🦄'

// // Use dot-notation to access nested properties
// store.set('foo.bar', true)
// console.log(store.get('foo'))
// // => {bar: true}

// store.delete('unicorn')
// console.log(store.get('unicorn'))
// => undefined
