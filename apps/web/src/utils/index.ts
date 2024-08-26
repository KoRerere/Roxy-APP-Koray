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
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function clearInputsValue(inputs: any): void {
  inputs.forEach((input: any) => {
    if (input.items) {
      clearInputsValue(input.items)
    } else {
      input.value = null
    }
  })
}

export function formatInputs(inputs: any[], original: any = {}): any {
  return inputs.reduce((formData, input) => {
    const { name, value, hide, items, formatValue } = input
    if (hide) return formData
    if (hasOwnProperty(formData, name)) {
      throw new Error(`Duplicate name '${name}' found in inputs`)
    }
    if (items) {
      Object.assign(formData, formatInputs(items))
    } else if (name) {
      const _value = value?.value ?? value
      formData[name] = isFunction(formatValue) ? formatValue(_value, input, inputs) : _value
    }
    return formData
  }, original)
}

export function formatInputsByList(inputsGroup: any[]): any {
  return inputsGroup.reduce((formData, inputs) => {
    const _data = formatInputs(inputs, formData)
    return Object.assign(formData, _data)
  }, {})
}

export function getValidByObject(obj: { [key: string]: any }, keys: string[]): any {
  return keys.reduce(
    (acc, key) => {
      if (obj[key]) {
        acc[key] = obj[key]
      }
      return acc
    },
    {} as { [key: string]: any }
  )
}
