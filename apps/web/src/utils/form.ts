import { hasOwnProperty, isFunction, isInvalid } from './basic'

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

function formVaildData(formData: any, input: any) {
  if (hasOwnProperty(formData, input.name)) {
    throw new Error(`Duplicate input.name '${input.name}' found in inputs`)
  }
  else if (input.required && isInvalid(input.value)) {
    input.invalid = true
    throw new Error(`Input '${input.name}' is required`)
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

export function setInputValueByFormData(inputs: any[], formData: any) {
  inputs.forEach((item: any) => {
    if (Array.isArray(item)) {
      setInputValueByFormData(item, formData)
      return
    }

    if (item.name && formData[item.name]) {
      item.value = formData[item.name]
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

export function filterFieldByValue(obj: object, filter: (value: any) => boolean) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => filter(v)))
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
