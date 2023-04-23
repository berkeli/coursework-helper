import * as Joi from 'joi'

export default Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  port: Joi.number().default(3001),
  defaultRepo: Joi.string().default('My-Coursework-Planner'),
  defaultOwner: Joi.string().default('CodeYourFuture'),
  clientUrls: Joi.array()
    .items(Joi.string())
    .default(['http://localhost:3000']),
  honeycombApiKey: Joi.string(),
  otelServiceName: Joi.string().default('CYF-Coursework-Helper-GH'),
  github: Joi.object({
    app: Joi.object({
      id: Joi.number().required(),
      privateKey: Joi.string().required(),
      clientId: Joi.string().required(),
      clientSecret: Joi.string().required(),
    }),
    oauth: Joi.object({
      clientId: Joi.string().required(),
      clientSecret: Joi.string().required(),
    }),
  }),
  redis: Joi.object({
    host: Joi.string().default('localhost'),
    port: Joi.number().required().default(6379),
    password: Joi.string().default(''),
  }),
})
