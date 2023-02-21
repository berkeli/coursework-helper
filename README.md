# COURSEWORK-HELPER APP

## Description
Coursework Helper is a github application that is created to manage the following:
1. Authenticate users of syllabus.codeyourfuture.io
2. Allow users to clone issues from the syllabus coursework pages

## Local Development
1. Clone the repository
2. Create a Github app (not an OAuth app) and add the following permissions:
    - Issues (Read & Write)
    - Repository contents (Read & Write)
3. Copy `.env.example` to `.env` and fill in the values as per the comments in the file
4. Run `npm install`
5. Run `npm dev`

## API Description
The API is a simple express server that has the following endpoints:
1. `/auth` - This is the endpoint that the user is redirected to after authenticating with Github. It will exchange the code for an access token and then redirect the user to the frontend.
2. `/clone` - This is the endpoint that the frontend will call to clone the issue(s). This enpoint accepts the following parameters:
    - `issue` - The issue number to clone (if not provided, all issues will be cloned)
    - `repo` - The repository to clone the issue from (required)
    - `ignoreDuplicates` - If set to `true`, the API will not clone the issue if it already exists in the user's repository (defaults to `false`)

Logic for cloning:
1. Check if user has a repository with the name from env (`DEFAULT_REPO`). If not, create it. Then, clone the issue from the `repo` to the user's repository. When creating the repository, the API will delete all default labels.
2. If the user already has a repository with the name from env (`DEFAULT_REPO`), then clone the issue from the `repo` to the user's repository. When cloning the issue, the API will create any new labels or milestones attached to issue.

## Deployment
The app is deployed to Render.


