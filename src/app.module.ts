import { redisStore } from 'cache-manager-redis-yet'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AuthController } from './auth/auth.controller'
import { githubServiceProvider } from './github/github.service'
import { GithubModule } from './github/github.module'
import { AuthService } from './auth/auth.service'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from '@nestjs/config'
import configuration from './configuration/configuration'

@Module({
  imports: [
    AuthModule,
    GithubModule,
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          ttl: 60 * 60 * 24,
          socket: {
            host: configuration().redis.host,
            port: configuration().redis.port,
          },
          password: configuration().redis.password,
        }),
      }),
      isGlobal: true,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),
  ],
  controllers: [AppController, AuthController],
  providers: [githubServiceProvider, AuthService],
})
export class AppModule {}
