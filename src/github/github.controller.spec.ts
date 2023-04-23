import { Test } from '@nestjs/testing'
import { HttpException, HttpStatus } from '@nestjs/common'
import { GithubController } from './github.controller'
import { GithubService } from './github.service'
import { CloneResponse, Issue } from './github.entity'

describe('GithubController', () => {
  let githubController: GithubController
  let githubService: GithubService

  const setAttributeSpy = jest.fn()
  jest
    .spyOn(require('@opentelemetry/api').trace, 'getActiveSpan')
    .mockReturnValue({
      setAttribute: setAttributeSpy,
    } as any)

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GithubController],
      providers: [
        {
          provide: GithubService,
          useValue: {
            getIssuesForRepo: jest.fn(),
            cloneIssue: jest.fn(),
            cloneAllIssues: jest.fn(),
            initialSetup: jest.fn(),
          },
        },
      ],
    }).compile()

    githubController = moduleRef.get<GithubController>(GithubController)
    githubService = moduleRef.get<GithubService>(GithubService)
  })

  describe('setup', () => {
    it('should return successful status when initial setup completes', async () => {
      jest
        .spyOn(githubService, 'initialSetup')
        .mockImplementation(() => Promise.resolve('OK'))

      const result = await githubController.setup()

      expect(result).toEqual({
        signedIn: true,
        repoCreated: true,
        projectBoardCopied: true,
      })
    })

    it('should return error status when initial setup fails', async () => {
      jest
        .spyOn(githubService, 'initialSetup')
        .mockImplementation(() => Promise.reject(new Error('Failed to set up')))

      try {
        await githubController.setup()
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect(error.status).toBe(500)
      }
    })
  })

  describe('getIssues', () => {
    it('should return the issues for the given repository', async () => {
      const repo = 'my-repo'
      const issues = [
        { id: 1, title: 'Issue 1' } as Issue,
        { id: 2, title: 'Issue 2' } as Issue,
      ]
      jest
        .spyOn(githubService, 'getIssuesForRepo')
        .mockImplementation(() => Promise.resolve(issues))

      const result = await githubController.getIssues(repo)

      expect(result).toEqual(issues)
    })

    it('should throw HttpException when getIssuesForRepo fails', async () => {
      const repo = 'my-repo'
      const error = new Error('Failed to get issues')
      jest
        .spyOn(githubService, 'getIssuesForRepo')
        .mockImplementation(() => Promise.reject(error))

      try {
        await githubController.getIssues(repo)
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException)
        expect(err.status).toBe(500)
      }
    })
  })

  describe('clone', () => {
    it('should call cloneIssue method of GithubService with correct arguments when issue number is provided', async () => {
      const repo = 'my-repo'
      const issue = 123
      const expectedResponse = { message: 'success' }
      ;(githubService.cloneIssue as jest.Mock).mockResolvedValueOnce(
        expectedResponse,
      )

      const response = await githubController.clone(repo, issue)

      expect(githubService.cloneIssue).toHaveBeenCalledWith(repo, issue)
      expect(response).toBe(expectedResponse)
    })

    it('should call cloneAllIssues method of GithubService with correct arguments when issue number is not provided', async () => {
      const repo = 'my-repo'
      const expectedResponse: CloneResponse = {
        total: 10,
        failed: 2,
        skipped: 1,
      }
      ;(githubService.cloneAllIssues as jest.Mock).mockResolvedValueOnce(
        expectedResponse,
      )

      const response = await githubController.clone(repo)

      expect(githubService.cloneAllIssues).toHaveBeenCalledWith(repo)
      expect(response).toBe(expectedResponse)
    })

    it('should throw an HttpException with status code 500 and error message from GithubService when cloneAllIssues method of GithubService throws an error', async () => {
      const repo = 'my-repo'
      const errorMessage = 'Error occurred while cloning issues'
      ;(githubService.cloneAllIssues as jest.Mock).mockRejectedValueOnce(
        new Error(errorMessage),
      )

      try {
        await githubController.clone(repo)
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException)
        expect(error.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
      }
    })
  })
})
