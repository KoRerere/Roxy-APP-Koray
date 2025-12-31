
import { isFunction, isInvalid } from './basic'

interface FormDataOptions {
  keyName: string
  valueName: string
}

export function findInputByName(inputs: any[], name: string): any {
  const list = inputs.slice()
  while (list?.length) {
    const input = list.shift()
    if (input.name === name) {
      return input
    }
    if (input.items && Array.isArray(input.items)) {
      list.unshift(...input.items)
    }
  }
}

export function filterInputsByNames(inputs: any[], names: string[]) {
  const list: any[] = []
  inputs?.forEach((input: any) => {
    if (Array.isArray(input)) {
      list.push(...filterInputsByNames(input, names))
    }
    else if (Array.isArray(input.items)) {
      list.push(...filterInputsByNames(input.items, names))
    }
    else if (names.includes(input.name)) {
      list.push(input)
    }
  })
  return list
}

export function getFormData(
  inputs: any[],
  original: object = {},
  options: FormDataOptions = { keyName: 'name', valueName: 'value' },
): any {
  const hadKey: Set<string> = new Set()

  const formData = (inputs || []).reduce(
    (formData, input) => {
      if (input.visible === false) {
        return formData
      }

      formValidator(hadKey, input)

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
        hadKey.add(name)// 记录以解析的字段
      }
      return formData
    },
    { ...original },
  )
  hadKey.clear()
  return formData
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

function formValidator(hadKey: Set<string>, input: any) {
  if (hadKey.has(input.name)) {
    throw new Error(`Duplicate input.name '${input.name}' found in inputs`)
  }
  else if (input.required && isInvalid(input.value)) {
    input.invalid = true
    input.errorMsg = $t('"{name}" 是必填项', { name: input.label || input.placeholder })
    throw new Error(input.errorMsg)
  }

  if (input.invalid || (isFunction(input.validator) && !input.validator(input))) {
    input.invalid = true
    const errorMsg = input.errorMsg || `Input '${input.name}' is invalid`
    throw new Error(errorMsg)
  }
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
  state: any,
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

export function setInputValueByFormData(inputs: any[], formData: any) {
  inputs.forEach((item: any) => {
    if (Array.isArray(item)) {
      setInputValueByFormData(item, formData)
      return
    }

    if (item.name && !isInvalid(formData[item.name])) {
      if (item.type === 'select' && !item.optionValue) {
        item.value = item.options.find((option: any) => option.value === formData[item.name])
      }
      else {
        item.value = formData[item.name]
        item.invalid = false
      }
    }
    if (item.items && Array.isArray(item.items)) {
      setInputValueByFormData(item.items, formData)
    }
  })
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

export function filterFieldByValue(obj: object, filter: (value: any) => boolean = (v: any) => !!v) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => filter(v)))
}

export function initInputVisible(value: any, assert: any, def: boolean) {
  return value !== undefined ? value === assert : def
}

// export function getValidByObject(
//   obj: { [key: string]: any },
//   keys: string[],
// ): any {
//   return keys.reduce(
//     (acc, key) => {
//       if (obj[key]) {
//         acc[key] = obj[key]
//       }
//       return acc
//     },
//     {} as { [key: string]: any },
//   )
// }
