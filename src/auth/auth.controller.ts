import {
  Controller,
  Dependencies,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Query,
  Res,
  Req,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { AuthEntity } from './auth.entity'
import { AuthService } from './auth.service'
import { Response, Request } from 'express'

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
  async getAccessToken(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code: string,
  ) {
    // check if httpOnly cookie is set
    // if (req.cookies.access_token) {
    //   return res
    //     .status(HttpStatus.OK)
    //     .json({
    //       message: 'User is already authenticated',
    //     })
    //     .end()
    // }

    if (!code) {
      throw new HttpException(
        { error: 'Code is required' },
        HttpStatus.BAD_REQUEST,
      )
    }

    const a = await this.authService.getAccessToken(code).catch((error) => {
      Logger.error(error.message, 'AuthController')

      throw new HttpException({ error: error.message }, HttpStatus.UNAUTHORIZED)
    })

    Logger.debug('setting cookie', 'AuthController', a.token)

    res.cookie('access_token', a.token, {
      httpOnly: true,
      sameSite: 'none',
    })

    res
      .json({
        message: 'User authenticated',
      })
      .end()
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token')

    res
      .status(HttpStatus.OK)
      .json({
        message: 'User logged out',
      })
      .end()
  }
}
