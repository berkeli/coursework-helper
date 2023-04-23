import { Module } from '@nestjs/common'
import { GithubService, githubServiceProvider } from './github.service'
import { GithubController } from './github.controller'

@Module({
  providers: [githubServiceProvider],
  exports: [GithubService],
  controllers: [GithubController],
})
export class GithubModule {}
