import {
  Injectable,
  Scope,
  HttpStatus,
  HttpException,
  Logger as log,
  Inject,
} from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { REQUEST } from '@nestjs/core'
import { Request } from 'express'
import { App, Octokit } from 'octokit'
import opentelemetry from '@opentelemetry/api'
import { Tracer, SpanStatusCode } from '@opentelemetry/api'
import * as _ from 'lodash'
import { CloneResponse, Issue, Milestone } from './github.entity'
import configuration from 'src/configuration/configuration'
import { GraphQlQueryResponseData } from '@octokit/graphql/dist-types/types'
import {
  addProjectV2ItemByIdMutation,
  getUserProjectsV2Query,
  linkProjectV2RepositoryMutation,
  makeProjectPublicMutation,
} from './gql'
import { Cache } from 'cache-manager'
import githubApp from './github.app'
import { ConfigService } from '@nestjs/config'

const GITHUB_DEFAULT_LABELS = [
  'bug',
  'documentation',
  'duplicate',
  'enhancement',
  'good first issue',
  'help wanted',
  'invalid',
  'question',
  'wontfix',
]

/**
 * Represents a GitHub service. This service is used to interact with the GitHub API.
 * It is injected into the GitHub controller per request, so that the Octokit instance is created with current user's access token.
 * @class
 */
@Injectable({ scope: Scope.REQUEST })
export class GithubService {
  /** The tracer for the GitHub service. */
  private readonly tracer: Tracer
  /** The Octokit instance that is used with user's JWT (specific to user) */
  private octokit: Octokit
  /** Global repository id */
  repositoryId: string
  /** The username for the authenticated user (trainee). */
  private login: string
  /** The ID of the owner of the repository (node_id). */
  private ownerId: string
  /** Project ID used to track coursework */
  projectId: string
  /** A map of milestone numbers to milestone IDs. */
  milestoneMap: {
    [key: string]: Milestone['number']
  } = {}

  /**
   * Creates a new instance of the GitHub service.
   * @constructor
   * @param {Octokit} octokit - The Octokit instance to use.
   * @param {string} ownerId - The ID of the owner of the repository.
   * @param {string} login - The username for the authenticated user.
   */
  constructor(
    octokit: Octokit,
    ownerId: string,
    login: string,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.tracer = opentelemetry.trace.getTracer('github-service')
    this.octokit = octokit
    this.ownerId = ownerId
    this.login = login
  }

  /**
   * Gets a list of issues for the specified repository.
   * @async
   * @param {string} repo - The name of the repository to get issues for.
   * @param {string} [owner=config.defaultOwner] - The owner of the repository. Defaults to the DEFAULT_OWNER specified in the environment variables.
   * @returns {Promise<Issue[]>} An array of issues for the specified repository.
   * @throws {HttpException} If the list of issues cannot be retrieved.
   */
  async getIssuesForRepo(
    repo: string,
    owner: string = this.configService.get('defaultOwner'),
  ): Promise<Issue[]> {
    const span = this.tracer.startSpan('getIssuesForRepo')
    const cacheKey = `${owner}/${repo}/issues`
    const cachedIssues = await this.cacheManager.get<Issue[]>(cacheKey)

    if (cachedIssues) {
      span.end()
      return cachedIssues
    }

    const issues = await this.octokit
      .paginate(this.octokit.rest.issues.listForRepo, {
        owner,
        repo,
        per_page: 100,
      })
      .catch((error) => {
        log.error(error, 'GithubService:getIssuesForRepo')
        span.end()
        throw new Error(
          `Could not get issues for ${owner}/${repo}, error: ${error.message}`,
        )
      })

    span.end()
    await this.cacheManager.set(cacheKey, issues)

    return issues
  }

  /**
   * Gets a list of milestones for the specified repository.
   * @async
   * @param {string} repo - The name of the repository to get issues for.
   * @param {string} [owner=config.defaultOwner] - The owner of the repository. Defaults to the DEFAULT_OWNER specified in the environment variables.
   * @returns {Promise<Milestone[]>} An array of milestones for the specified repository.
   * @throws {HttpException} If the list of milestones cannot be retrieved.
   */
  async getMilestonesForRepo(
    repo: string,
    owner: string = this.configService.get('defaultOwner'),
  ): Promise<Milestone[]> {
    const span = this.tracer.startSpan('getMilestonesForRepo')
    const cacheKey = `${owner}/${repo}/milestones`
    const cachedMilestones = await this.cacheManager.get<Milestone[]>(cacheKey)

    if (cachedMilestones) {
      span.end()
      return cachedMilestones
    }

    const milestones = await this.octokit
      .paginate(this.octokit.rest.issues.listMilestones, {
        owner,
        repo,
        state: 'all',
        per_page: 100,
      })
      .catch((error) => {
        log.error(error, 'GithubService:getMilestonesForRepo')
        span.end()
        throw new Error(
          `Could not get milestones for ${owner}/${repo}, error: ${error.message}`,
        )
      })
    span.end()
    await this.cacheManager.set(cacheKey, milestones)

    return milestones
  }

  /**
   * Creates a default repository with the specified name.
   * @async
   * @function
   * @name createDefaultRepo
   * @memberof GithubService
   * @param {string} [repoName=this.configService.get("defaultRepo")] - The name of the repository to create. Defaults to the default repository specified in the config.
   * @returns {string} The created repository's node_id.
   * @throws {Error} If the repository cannot be created.
   */
  async createDefaultRepo(
    repoName: string = this.configService.get('defaultRepo'),
  ): Promise<string> {
    const span = this.tracer.startSpan('createDefaultRepo')
    const { data } = await this.octokit.rest.repos
      .createForAuthenticatedUser({
        name: repoName,
        has_issues: true,
        private: false,
        has_projects: true,
      })
      .catch((error) => {
        span.end()
        log.error(error, 'GithubService:createDefaultRepo')
        throw new Error(`Could not create ${repoName}, error: ${error.message}`)
      })

    this.repositoryId = data.node_id

    // remove all labels (these are the default labels)
    const spanDeleteLabels = this.tracer.startSpan('deleteLabels')
    for (const label of GITHUB_DEFAULT_LABELS) {
      await this.octokit.rest.issues
        .deleteLabel({
          owner: this.login,
          repo: repoName,
          name: label,
        })
        .catch((error) => {
          // non-fatal error, but still log
          log.error(error, 'GithubService:createDefaultRepo')
        })
    }
    spanDeleteLabels.end()
    span.end()

    return data.node_id
  }

  /**
  Creates a repository with the specified name or gets the existing one.
  * @async
  * @function
  * @name createOrGetDefaultRepo
  * @memberof GithubService
  * @param {string} [repoName=this.configService.get("defaultRepo")] - The name of the repository to create. Defaults to the DEFAULT_REPO specified in the environment variables.
  * @returns {Promise<string>} The created repository's node_id or the existing one's node_id if found.
  * @throws {Error} If the repository cannot be created.
  */
  async createOrGetDefaultRepo(
    repoName: string = this.configService.get('defaultRepo'),
  ): Promise<string> {
    const span = this.tracer.startSpan('createOrGetDefaultRepo')
    const getRepo = await this.octokit.rest.repos
      .get({
        owner: this.login,
        repo: repoName,
      })
      .catch((error) => {
        if (error.status !== 404) {
          log.error(error, 'GithubService:upsertDefaultRepo')
          span.end()
          throw new Error(`Could not get ${repoName}, error: ${error.message}`)
        }
      })

    if (!getRepo) {
      const res = await this.createDefaultRepo(repoName)
      span.end()
      return res
    }

    this.repositoryId = getRepo.data.node_id
    span.end()
    return getRepo.data.node_id
  }

  async upsertMilestones(sourceRepoName: string): Promise<boolean> {
    const span = this.tracer.startSpan('upsertMilestones')

    // get milestones for user
    const userMilestones = await this.getMilestonesForRepo(
      this.configService.get('defaultRepo'),
      this.login,
    ).catch((error) => {
      log.error(error, 'GithubService:upsertMilestones')
      span.end()
      throw new Error(
        `Could not get milestones for ${this.login}/${this.configService.get(
          'defaultRepo',
        )}, error: ${error.message}`,
      )
    })

    // create hash map of milestones
    // because id is not guaranteed to be the same for everyone
    userMilestones.forEach((milestone) => {
      if (milestone?.title) {
        this.milestoneMap[milestone.title] = milestone.number
      }
    })

    const newMilestones: Milestone[] = []

    // create labels and milestones that don't exist
    const repoMilestones = await this.getMilestonesForRepo(
      sourceRepoName,
    ).catch((error) => {
      log.error(error, 'GithubService:upsertMilestones')
      span.end()
      throw new Error(
        `Could not get milestones for ${this.login}/${sourceRepoName}, error: ${error.message}`,
      )
    })

    repoMilestones.forEach((milestone) => {
      if (milestone?.title) {
        if (!this.milestoneMap[milestone.title]) {
          newMilestones.push(milestone)
        }
      }
    })

    const uniques = _.uniqWith<Milestone>(newMilestones, _.isEqual)

    for (const milestone of uniques) {
      if (!milestone || !milestone.title) {
        continue
      }
      const { data } = await this.octokit.rest.issues
        .createMilestone({
          owner: this.login,
          repo: this.configService.get('defaultRepo'),
          title: milestone.title as string,
          description: milestone.description as string,
          state: 'open',
          due_on: milestone.due_on || undefined,
        })
        .catch((error) => {
          log.error(error, 'GithubService:upsertMilestones')
          span.end()
          throw new Error(
            `Could not create milestone ${milestone.title}, error: ${error.message}`,
          )
        })

      this.milestoneMap[milestone.title] = data.number
    }
    span.end()
    return true
  }

  async setupDefaultProject(): Promise<string> {
    const span = this.tracer.startSpan('getDefaultProject')
    const {
      user: {
        projectsV2: {
          nodes: [project],
        },
      },
    } = await this.octokit
      .graphql<GraphQlQueryResponseData>(getUserProjectsV2Query, {
        login: this.login,
      })
      .catch((error) => {
        log.error(error, 'GithubService:setupDefaultProject')
        span.end()
        throw new Error(
          `Could not get projects for ${this.login}, error: ${error.message}`,
        )
      })

    if (!project?.id) {
      span.end()
      throw new Error(
        "No project found that matches 'coursework planner' query",
      )
    }

    if (!project.repositories.nodes.length) {
      // add default repo to project
      await this.octokit
        .graphql(linkProjectV2RepositoryMutation, {
          projectId: project.id,
          repositoryId: this.repositoryId,
        })
        .catch((error) => {
          log.error(error, 'GithubService:setupDefaultProject')
          span.end()
          throw new Error(
            `Could not link project ${project.id} to repository ${this.repositoryId}, error: ${error.message}`,
          )
        })
    } else {
      // set repoId from project
      this.repositoryId = project.repositories.nodes[0].id
    }

    // make project public
    if (!project.public) {
      await this.octokit
        .graphql(makeProjectPublicMutation, {
          projectId: project.id,
        })
        .catch((error) => {
          log.error(error, 'GithubService:setupDefaultProject')
          span.end()
          throw new Error(
            `Could not make project ${project.id} public, error: ${error.message}`,
          )
        })
    }

    this.projectId = project.id

    span.end()
    return project.id
  }

  async initialSetup(): Promise<string> {
    const span = this.tracer.startSpan('initialSetup')
    await this.createOrGetDefaultRepo()

    await this.setupDefaultProject()

    span.end()

    return 'OK'
  }

  async createIssue(issue: Issue, res: CloneResponse) {
    const span = this.tracer.startSpan('createIssue')
    span.setAttribute('issue.title', issue.title)
    const createIssueRes = await this.octokit.rest.issues
      .create({
        owner: this.login,
        assignees: [this.login],
        repo: this.configService.get('defaultRepo'),
        title: issue.title,
        body: issue.body,
        milestones: issue.milestone
          ? [this.milestoneMap[issue.milestone.title]]
          : [],
        labels: issue.labels,
      })
      .catch((error) => {
        res.failed++
        span.setStatus({
          code: SpanStatusCode.ERROR,
        })
        log.error(error, 'GithubService:createIssue')
      })

    if (createIssueRes && this.projectId) {
      const res = await this.octokit
        .graphql<GraphQlQueryResponseData>(addProjectV2ItemByIdMutation, {
          projectId: this.projectId,
          contentId: createIssueRes.data.node_id,
        })
        .catch((error) => {
          log.error(error, 'GithubService:createIssue')
          span.setStatus({
            code: SpanStatusCode.ERROR,
          })
        })
    }

    span.end()
    return createIssueRes
  }

  async cloneAllIssues(
    sourceRepoName: string,
    allowDuplicates: boolean = false,
  ): Promise<CloneResponse> {
    const span = this.tracer.startSpan('cloneAllIssues')

    const issues = await this.getIssuesForRepo(sourceRepoName).catch(
      (error) => {
        span.end()
        throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
      },
    )

    if (!issues || issues.length === 0) {
      span.end()
      throw new HttpException('No issues found', HttpStatus.BAD_REQUEST)
    }

    await this.initialSetup()

    await this.upsertMilestones(sourceRepoName)

    // get all issues from user's repo to check for duplicates
    const userIssueMap: { [key: string]: boolean } = {}
    if (!allowDuplicates) {
      const userIssues = await this.getIssuesForRepo(
        this.configService.get('defaultRepo'),
        this.login,
      ).catch((error) => {
        span.end()
        throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR)
      })

      userIssues.forEach((issue) => {
        if (issue?.title) {
          userIssueMap[issue.title] = true
        }
      })
    }

    const res = new CloneResponse(issues.length)

    for (const issue of issues) {
      if (!issue.body || userIssueMap[issue.title]) {
        res.skipped++
        continue
      }

      await this.createIssue(issue, res)
    }

    span.end()
    return res
  }

  async cloneIssue(
    sourceRepoName: string,
    issueNumber: number,
    allowDuplicates = false,
  ): Promise<CloneResponse> {
    const span = this.tracer.startSpan('cloneIssue')
    const { data } = await this.octokit.rest.issues
      .get({
        owner: this.configService.get('defaultOwner'),
        repo: sourceRepoName,
        issue_number: issueNumber,
      })
      .catch((error) => {
        log.error(error, 'GithubService:cloneSingleIssue')
        throw new HttpException(
          `Could not get issue ${issueNumber} from ${sourceRepoName}, error: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        )
      })

    await this.initialSetup()

    await this.upsertMilestones(sourceRepoName)

    const res = new CloneResponse(1)

    await this.createIssue(data, res)

    span.end()
    return res
  }
}

/**
 * Creates an instance of the GithubService by injecting the required dependencies.
 * @async
 * @function
 * @param {Request} request - The HTTP request object to obtain the JWT Token from.
 * @returns {Promise<GithubService>} The newly created GithubService instance.
 * @throws {HttpException} If the JWT Token is missing or invalid.
 */
export const githubServiceProvider = {
  provide: GithubService,
  inject: [REQUEST, CACHE_MANAGER, ConfigService],
  useFactory: async (
    request: Request,
    cache: Cache,
    configService: ConfigService,
  ) => {
    // if request is to get issues, use installation octokit. Otherwise use user octokit)
    if (request.path.endsWith('/github/issues') && request.method === 'GET') {
      let installId: number
      const defaultOrgInstallation = await githubApp
        .request('GET /orgs/:org/installation', {
          org: configService.get('defaultOwner'),
        })
        .catch((error) => {
          log.error(error, 'GithubService')
        })

      if (!defaultOrgInstallation) {
        log.debug(
          'No default org installation found, trying first installation id',
          'GithubService',
        )
        const allInstallations = await githubApp
          .request('GET /app/installations')
          .catch((error) => {
            log.error(error, 'GithubService')
            throw new HttpException(
              `Could not get installations, app must be installed in the organization. Error: ${error.message}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            )
          })

        installId = allInstallations.data[0].id
      } else {
        installId = defaultOrgInstallation.data.id
      }

      const app = new App({
        appId: configService.get('github.app.id'),
        privateKey: configService.get('github.app.privateKey'),
      })

      const installOctokit = await app.getInstallationOctokit(installId)

      return new GithubService(installOctokit, '', '', cache, configService)
    }
    const token = request.headers.authorization
    if (!token) {
      log.error('Missing JWT Token', 'GithubService')
      throw new HttpException('Missing JWT Token', HttpStatus.UNAUTHORIZED)
    }

    const userOctokit = new Octokit({
      auth: token.split(' ')[1],
    })

    // get authenticated user to get login and node_id
    // this will work as a middleware to check if the token is valid before the request is processed
    const { data } = await userOctokit.rest.users
      .getAuthenticated()
      .catch((error) => {
        log.error(error, 'GithubService')
        throw new HttpException(
          `Could not get authenticated user, error: ${error.message}`,
          HttpStatus.UNAUTHORIZED,
        )
      })

    return new GithubService(
      userOctokit,
      data.node_id,
      data.login,
      cache,
      configService,
    )
  },
}
