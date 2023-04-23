import { ApiProperty } from '@nestjs/swagger'

export class AuthEntity {
  @ApiProperty()
  token: string

  @ApiProperty()
  tokenType: string

  @ApiProperty()
  expiresAt: string
}
