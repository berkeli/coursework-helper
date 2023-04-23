import { Octokit } from '@octokit/core'
import { createAppAuth } from '@octokit/auth-app'
import configuration from '../configuration/configuration'

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: configuration().github.app.id,
    privateKey: configuration().github.app.privateKey,
    clientId: configuration().github.app.clientId,
    clientSecret: configuration().github.app.clientSecret,
  },
})

export default octokit
