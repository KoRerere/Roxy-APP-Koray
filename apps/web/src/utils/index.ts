function getRawType(data: any) {
  return Object.prototype.toString.call(data).slice(8, -1).toLowerCase()
}

export function isObject(data: any) {
  return getRawType(data) === 'object'
}

export function isFunction(fn: any) {
  return getRawType(fn) === 'function'
}

export function hasOwnProperty(data: any, key: any) {
  return Object.prototype.hasOwnProperty.call(data, key)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function clearInputsValue(inputs: any): void {
  inputs.forEach((input: any) => {
    if (input.items) {
      clearInputsValue(input.items)
    }
    else {
      input.value = null
    }
  })
}

export function isEmptyValue(value: any) {
  if (Array.isArray(value)) {
    return value.length === 0
  }
  else if (isObject(value)) {
    return Object.keys(value).length === 0
  }
  return isInvalid(value)
}

function isInvalid(value: any) {
  return [null, undefined, ''].includes(value)
}

function formVaildData(formData: any, input: any) {
  if (hasOwnProperty(formData, input.name)) {
    throw new Error(`Duplicate input.name '${input.name}' found in inputs`)
  }
  else if (input.required && isInvalid(input.value)) {
    input.invalid = true
    throw new Error(`Input '${input.name}' is required`)
  }
}

interface FormDataOptions {
  keyName: string
  valueName: string
}

export function getFormData(
  inputs: any[],
  original: object = {},
  options: FormDataOptions = { keyName: 'name', valueName: 'value' },
): any {
  return inputs.reduce(
    (formData, input) => {
      if (input.visible === false) {
        return formData
      }

      formVaildData(formData, input)

      const name = input[options.keyName]
      const value = input[options.valueName]
      const { items, formatValue } = input

      if (items) {
        Object.assign(formData, getFormData(items))
      }
      else if (name?.trim()) {
        const _value = value?.value ?? value ?? ''
        formData[name] = isFunction(formatValue)
          ? formatValue(input, inputs, formData)
          : _value
      }
      return formData
    },
    { ...original },
  )
}

export function getFormDataByList(
  inputsGroup: any[],
  original: object = {},
  options: FormDataOptions = { keyName: 'name', valueName: 'value' },
): any {
  return Array.isArray(inputsGroup)
    ? inputsGroup.reduce((formData, inputs) => {
      const _data = getFormData(inputs, formData, options)
      return Object.assign(formData, _data)
    }, original)
    : []
}

export function createDefaultObject<T extends string[], U>(keys: T, defaultValue: U) {
  return keys.reduce((res, key) => ({ ...res, [key]: defaultValue }), {} as { [K in T[number]]: U })
}

export function setInputVisible(
  inputs: any[],
  names: string | string[],
  state: boolean,
) {
  setInputFieldByInputKey(inputs, names, 'visible', state)
}

export function setInputValue(
  inputs: any[],
  names: string | string[],
  state: boolean,
) {
  setInputFieldByInputKey(inputs, names, 'value', state)
}

export function setInputFieldByInputKey(
  inputs: any[],
  inputNames: string | string[],
  inputKey: string,
  value: any,
) {
  const setNames: string[] = ([] as string[]).concat(inputNames)
  inputs.forEach((item: any) => {
    if (setNames.includes(item.name)) {
      item[inputKey] = value
    }
    if (item.items && Array.isArray(item.items)) {
      setInputFieldByInputKey(item.items, setNames, inputKey, value)
    }
  })
}

export function getValidByObject(
  obj: { [key: string]: any },
  keys: string[],
): any {
  return keys.reduce(
    (acc, key) => {
      if (obj[key]) {
        acc[key] = obj[key]
      }
      return acc
    },
    {} as { [key: string]: any },
  )
}

export function getImage(path: string) {
  return new URL(`../assets/image/${path}`, import.meta.url).href
}

export function deepClone<T>(source: T, hash = new WeakMap()): T {
  if (typeof source !== 'object' || source === null) {
    return source
  }
  if (hash.has(source)) {
    return hash.get(source)
  }
  const target: any = Array.isArray(source) ? [] : {}
  hash.set(source, target);
  (Reflect.ownKeys(source) as (keyof T)[]).forEach((key) => {
    target[key] = deepClone((source as any)[key], hash)
  })
  return target
}

export function EQ<T>(list: T[], field: keyof T): boolean {
  return list.some(item => !item[field])
}
