import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { GithubService } from './github.service'
import { ApiParam, ApiOkResponse } from '@nestjs/swagger'
import { CloneResponse } from './github.entity'
import opentelemetry from '@opentelemetry/api'

@Controller('github')
export class GithubController {
  private readonly githubService: GithubService
  constructor(githubService: GithubService) {
    this.githubService = githubService
  }

  @Post('initial-setup')
  async setup() {
    try {
      await this.githubService.initialSetup()

      return {
        signedIn: true,
        repoCreated: true,
        projectBoardCopied: true,
      }
    } catch (e) {
      throw new HttpException(
        {
          error: e.message,
          setupStatus: {
            signedIn: true,
            repoCreated: this.githubService.repositoryId !== undefined,
            projectBoardCopied: this.githubService.projectId !== undefined,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Get('issues')
  async getIssues(@Query('repo') repo: string) {
    return this.githubService.getIssuesForRepo(repo).catch((e) => {
      throw new HttpException(
        {
          error: e.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    })
  }

  @Post('clone/:repo/:issue?')
  @ApiParam({
    name: 'repo',
    description: 'The repository to clone',
    required: true,
  })
  @ApiParam({
    name: 'sprint',
    description: 'The sprint to select issues from',
    required: true,
  })
  @ApiParam({
    name: 'issue',
    description:
      'The issue number to clone. If not provided, all issues will be cloned',
    required: false,
  })
  @ApiOkResponse({
    description: 'Returns the details about cloned issues',
    type: CloneResponse,
  })
  async clone(
    @Param('repo') repo: string,
    @Param('issue') issue?: number,
    @Query('sprint') sprint?: string,
  ) {
    if (issue) {
      return this.githubService.cloneIssue(repo, issue).catch((e) => {
        throw new HttpException(
          { error: e.message },
          HttpStatus.INTERNAL_SERVER_ERROR,
        )
      })
    }

    Logger.debug('Cloning all issues', { repo, sprint })

    const s = opentelemetry.trace.getActiveSpan()
    s.setAttribute('repo', repo)
    s.setAttribute('issue', issue)

    const res = await this.githubService
      .cloneAllIssues(repo, sprint)
      .catch((e) => {
        s.setAttribute('error', true)
        s.setAttribute('error.message', e.message)
        s.setAttribute('error.stack', e.stack)
        throw new HttpException(
          { error: e.message },
          HttpStatus.INTERNAL_SERVER_ERROR,
        )
      })

    s.setAttribute('issues', res.total)
    s.setAttribute('failed', res.failed)
    s.setAttribute('skipped', res.skipped)

    return res
  }
}
