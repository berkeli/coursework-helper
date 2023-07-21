import {
  Controller,
  Dependencies,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { AuthEntity } from './auth.entity'
import { AuthService } from './auth.service'

@Controller('auth')
@ApiTags('auth')
@Dependencies(AuthService)
export class AuthController {
  private readonly authService: AuthService
  constructor(authService: AuthService) {
    this.authService = authService
  }
  @Post()
  @ApiOkResponse({
    description: 'Returns JWT access token for the user with the given code',
    type: AuthEntity,
  })
  @ApiBadRequestResponse({
    description: 'Code is required',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid code',
  })
  async getAccessToken(@Query('code') code: string) {
    if (!code) {
      throw new HttpException(
        { error: 'Code is required' },
        HttpStatus.BAD_REQUEST,
      )
    }

    return this.authService.getAccessToken(code).catch((error) => {
      Logger.error(error.message, 'AuthController')

      throw new HttpException({ error: error.message }, HttpStatus.UNAUTHORIZED)
    })
  }
}
