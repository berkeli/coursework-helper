import { Injectable } from '@nestjs/common'
import { createAppAuth } from '@octokit/auth-app'
import { AuthInterface } from '@octokit/auth-app/dist-types/types'
import { AuthEntity } from 'src/auth/auth.entity'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AuthService {
  private readonly auth: AuthInterface

  constructor(private configService: ConfigService) {
    this.auth = createAppAuth({
      appId: configService.get('github.app.id'),
      privateKey: configService.get('github.app.privateKey'),
      clientId: configService.get('github.app.clientId'),
      clientSecret: configService.get('github.app.clientSecret'),
    })
  }

  async getAccessToken(code: string): Promise<AuthEntity | null> {
    const userAuthentication = await this.auth({
      type: 'oauth-user',
      code,
    })

    if (!userAuthentication) {
      return null
    }

    return {
      token: userAuthentication.token,
      tokenType: userAuthentication.tokenType,
      expiresAt: (userAuthentication as AuthEntity).expiresAt,
    }
  }
}
