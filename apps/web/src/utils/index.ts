export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function formatInputs(inputs: any[]): any {
  return inputs.reduce((formData, input) => {
    const { name, value, items } = input
    if (Object.prototype.hasOwnProperty.call(formData, name)) {
      throw new Error(`Duplicate name '${name}' found in inputs`)
    }
    if (items) {
      Object.assign(formData, formatInputs(items))
    } else if (name) {
      formData[name] = value
    }
    return formData
  }, {})
}
