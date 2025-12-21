## Install & run locally

`npm run install:all`

`npm run emulators` (in one terminal)

`npm run client` (in another terminal)

Clickable links will appear in both console windows for emulators and web app.

Access the app from mobile phone on the same network to test QR codes.

## Set up new environment

- Create a new firebase project, add firebase storage and firestore to the project
- In root package.json replace "my-project-id" with your actual project ID

## Build & deploy

Build before deployment to ensure no compilation errors across the board.

`npm run build`

Then deploy.

`npm run deploy`

or

`npm run deploy:quick` to just redeploy the client

## Deploying to a new project

Don't forget

`gcloud auth login`

`gsutil cors set cors.json gs://your-project-id.firebasestorage.app`

.. to allow the client app to access files on firebase storage
