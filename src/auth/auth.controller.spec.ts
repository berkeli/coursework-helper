import { Test, TestingModule } from '@nestjs/testing'
import { HttpStatus, HttpException } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthEntity } from './auth.entity'
import { ConfigService } from '@nestjs/config'

describe('AuthController', () => {
  let controller: AuthController
  let service: AuthService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              return 123
            }),
          },
        },
      ],
    }).compile()

    controller = module.get<AuthController>(AuthController)
    service = module.get<AuthService>(AuthService)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getAccessToken', () => {
    const code = 'fake-code'
    const authEntity: AuthEntity = {
      token: 'fake-token',
      tokenType: 'bearer',
      expiresAt: '2023-03-26T10:00:00.000Z',
    }

    it('should throw an error if code is not provided', async () => {
      const expectedError = new HttpException(
        'Code is required',
        HttpStatus.BAD_REQUEST,
      )

      await expect(controller.getAccessToken('')).rejects.toThrow(expectedError)
    })

    it('should throw an error if authService.getAccessToken returns null', async () => {
      jest.spyOn(service, 'getAccessToken').mockImplementationOnce(() => {
        throw new Error('Failed to authenticate user')
      })

      const expectedError = new HttpException(
        'Failed to authenticate user',
        HttpStatus.UNAUTHORIZED,
      )

      await expect(controller.getAccessToken(code)).rejects.toThrow(
        expectedError,
      )
    })

    it('should return an auth entity object', async () => {
      jest.spyOn(service, 'getAccessToken').mockResolvedValueOnce(authEntity)

      const result = await controller.getAccessToken(code)

      expect(result).toEqual(authEntity)
    })

    it('should catch and throw any errors from authService.getAccessToken', async () => {
      const errorMessage = 'Failed to get access token'
      jest
        .spyOn(service, 'getAccessToken')
        .mockRejectedValueOnce(new Error(errorMessage))

      const expectedError = new HttpException(
        errorMessage,
        HttpStatus.BAD_REQUEST,
      )

      await expect(controller.getAccessToken(code)).rejects.toThrow(
        expectedError,
      )
    })
  })
})
