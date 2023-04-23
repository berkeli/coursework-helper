# COURSEWORK-HELPER APP

## Description
Coursework Helper is a github application that is created to manage the following:
1. Authenticate users of syllabus.codeyourfuture.io
2. Allow users to clone issues from the syllabus coursework pages

## Local Development
1. Clone the repository
2. Create Github app and OAuth app and add the following permissions:
    - Issues (Read & Write)
    - Repository contents (Read & Write)
    - Projects (Read & Write)
3. Copy `.env.example` to `.env` and fill in the values as per the comments in the file
4. Run `npm install`

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# test coverage
$ npm run test:cov
```

## API Description

API uses swagger for documentation. To view the documentation, run the app and go to `http://localhost:3001/v1/docs`

## Deployment
The app is deployed to Render.

