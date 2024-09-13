import { IsEmail, IsNotEmpty, Length } from 'class-validator'
import type { LoginCreatePayload } from '@roxy/backend-api'

export class UserForm implements LoginCreatePayload {
  @IsNotEmpty({ message: 'Name is required' })
  @Length(2, 30, { message: 'Name must be between 2 and 30 characters' })
  user_name: string = ''

  @IsEmail({}, { message: 'Invalid email address' })
  email: string = ''

  @IsNotEmpty({ message: 'Password is required' })
  @Length(6, 20, { message: 'Password must be between 6 and 20 characters' })
  password: string = ''

  test?: string
}
