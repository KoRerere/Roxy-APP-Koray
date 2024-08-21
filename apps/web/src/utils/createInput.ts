import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Password from 'primevue/password'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Checkbox from 'primevue/checkbox'
import RadioButton from 'primevue/radiobutton'
import DatePicker from 'primevue/datepicker'
import { type DefineComponent, createVNode } from 'vue'

type InputType = keyof typeof INPUT_MAP

const INPUT_MAP: { [key: string]: DefineComponent<object, object, any> } = {
  text: InputText,
  number: InputNumber,
  password: Password,
  textarea: Textarea,
  select: Select,
  radio: RadioButton,
  checkbox: Checkbox,
  date: DatePicker
}

interface PropsType {
  type: InputType
  [key: string]: any
}

export function CreateInput(props: PropsType) {
  const { type, ..._props } = props
  const Input = INPUT_MAP[type]
  return createVNode(Input, _props)
}

export default CreateInput
