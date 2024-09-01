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

function isInvalid(value: any) {
  return !value && value !== 0
}

interface FormDataOptions {
  keyName: string
  valueName: string
}

function formVaildData(formData: any, input: any) {
  if (hasOwnProperty(formData, input.name)) {
    throw new Error(`Duplicate input.name '${input.name}' found in inputs`)
  }
  if (input.required && isInvalid(input.value)) {
    input.invalid = true
    throw new Error(`Input '${input.name}' is required`)
  }
}

export function getFormData(
  inputs: any[],
  original: object = {},
  options: FormDataOptions = { keyName: 'name', valueName: 'value' },
): any {
  return inputs.reduce(
    (formData, input) => {
      const { visible, items, formatValue } = input
      const name = input[options.keyName]
      const value = input[options.valueName]

      if (visible === false)
        return formData
      formVaildData(formData, input)

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
