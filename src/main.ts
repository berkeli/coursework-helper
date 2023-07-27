import * as cookieParser from 'cookie-parser'
import { NestFactory } from '@nestjs/core'
import { AppModule } from 'src/app.module'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { otelSDK } from 'src/tracing'
import configuration from 'src/configuration/configuration'

async function bootstrap() {
  otelSDK.start()
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: configuration().clientUrls,
    methods: ['GET', 'POST'],
    credentials: true,
  })

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  })

  app.use(cookieParser())

  const config = new DocumentBuilder()
    .setTitle('CYF Coursework Helper API')
    .setDescription(
      'This is the API for the CYF Coursework Helper application. It is used to batch clone issues from the CYF Coursework Repo to the student repos.',
    )
    .setVersion('v1')
    .build()

  app.useGlobalPipes(new ValidationPipe())

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('/:version/docs', app, document)

  await app.listen(configuration().port)
}
bootstrap()
