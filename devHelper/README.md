# How to generate mock data and start developing in your local 

## Step.1 start elasticsearch
```docker-compose -f ./esearch.yml up -d```

## Step.2 import mock data into elasticsearch index
```cd scripts/ && sh ./generate_data.sh```

## Step.3 start server for developing server side code
Go to repo root directory, and run
```npm start```
The Guppy server will be hosted at [localhost:3000/graphql](http://localhost:3000/graphql), now use Insomnia or Postman to play with it! 
We use nodemon to start the server, so all code change will be hot applied to the running server in realtime. 

## Step.4 start storybook for developing front-end components
Go to repo root directory, and run
```npm run storybook```
[Storybook](https://storybook.js.org/) will be hosted at [localhost:6006](http://localhost:6006). 
