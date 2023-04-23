import * as dotenv from 'dotenv'
import validationSchema from './validationSchema'

dotenv.config()

const config = () => {
  const { value, error } = validationSchema.validate(
    {
      NODE_ENV: process.env.NODE_ENV,
      port: process.env.PORT,
      defaultRepo: process.env.DEFAULT_REPO,
      defaultOwner: process.env.DEFAULT_OWNER,
      clientUrls: process.env.CLIENT_URLS?.split(','),
      honeycombApiKey: process.env.HONEYCOMB_API_KEY,
      otelServiceName: process.env.OTEL_SERVICE_NAME,
      github: {
        app: {
          id: process.env.APP_ID,
          privateKey: process.env.PRIVATE_KEY,
          clientId: process.env.APP_CLIENT_ID,
          clientSecret: process.env.APP_CLIENT_SECRET,
        },
        oauth: {
          clientId: process.env.OAUTH_CLIENT_ID,
          clientSecret: process.env.OAUTH_CLIENT_SECRET,
        },
      },
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
      },
    },
    { abortEarly: false },
  )

  if (error) {
    throw new Error(`Config validation error: ${error.message}`)
  }

  return value
}

export default config
