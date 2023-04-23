import { Test } from '@nestjs/testing'
import { HttpException, HttpStatus } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AuthEntity } from './auth.entity'

describe('AuthController', () => {
  let controller: AuthController
  let authService: AuthService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            getAccessToken: jest.fn(),
          },
        },
      ],
    }).compile()

    controller = moduleRef.get<AuthController>(AuthController)
    authService = moduleRef.get<AuthService>(AuthService)
  })

  describe('getAccessToken', () => {
    it('should throw an error if code is not provided', async () => {
      await expect(controller.getAccessToken(undefined)).rejects.toThrowError(
        new HttpException('Code is required', HttpStatus.BAD_REQUEST),
      )
    })

    it('should call AuthService.getAccessToken with the provided code', async () => {
      const code = 'test-code'
      const expectedResponse: AuthEntity = {
        token: 'test-token',
        expiresAt: 'test-expires-at',
        tokenType: 'test-token-type',
      }

      jest
        .spyOn(authService, 'getAccessToken')
        .mockResolvedValueOnce(expectedResponse)

      const response = await controller.getAccessToken(code)

      expect(authService.getAccessToken).toHaveBeenCalledWith(code)
      expect(response).toEqual(expectedResponse)
    })

    it('should throw an error if AuthService.getAccessToken throws an error', async () => {
      const code = 'test-code'
      const expectedError = new Error('Invalid code')

      jest
        .spyOn(authService, 'getAccessToken')
        .mockRejectedValueOnce(expectedError)

      await expect(controller.getAccessToken(code)).rejects.toThrowError(
        new HttpException(expectedError.message, HttpStatus.UNAUTHORIZED),
      )
    })
  })
})
