import { Injectable, Logger } from '@nestjs/common'
import { createOAuthAppAuth } from '@octokit/auth-oauth-app'
import { OAuthAppAuthInterface } from '@octokit/auth-oauth-app/dist-types/types'
import { AuthEntity } from 'src/auth/auth.entity'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AuthService {
  private readonly auth: OAuthAppAuthInterface

  constructor(private configService: ConfigService) {
    this.auth = createOAuthAppAuth({
      clientType: 'oauth-app',
      clientId: configService.get('github.oauth.clientId'),
      clientSecret: configService.get('github.oauth.clientSecret'),
    })
  }

  async getAccessToken(code: string): Promise<AuthEntity | null> {
    const userAuthentication = await this.auth({
      type: 'oauth-user',
      code,
    })

    console.log(userAuthentication)

    if (!userAuthentication) {
      return null
    }

    return {
      type: userAuthentication.type,
      token: userAuthentication.token,
      tokenType: userAuthentication.tokenType,
    }
  }
}
