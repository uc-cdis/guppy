# How to generate mock data and start developing in your local 

## Step.1 start elasticsearch
Go to the repository's root directory, do:
```
docker-compose -f ./devHelper/docker/esearch.yml up -d
```

## Step.2 import mock data into elasticsearch index
In the root directory of this repo, run the following command:

```
sh ./generate_data.sh
```

Doing so will automatically generate 3 ES indices (1 for `subject`, 1 for `file`, and 1 for `config`) and populate 100 records into each index.

### Manually generate more mock data for a specific elasticsearch index (optional)
In case we want more mock data, Guppy has a helper function to generate mock data for a specific ES index. For example, to generate data for an ES index called `gen3-dev-subject` with document type `subject`, run the following command:
```
npm run gendata -- -i gen3-dev-subject -d subject
```

Here is a complete list of arguments that `npm run gendata` would take
| argument                     | description                                            | default           |
|------------------------------|--------------------------------------------------------|-------------------|
| -v, --verbose                | verbose output                                         | false             |
| -h, --hostname `<hostname>`  | elasticsearch hostname                                 | http://localhost  |
| -p, --port `<port>`          | elasticsearch port                                     | 9200              |
| -i, --index `<index>`        | elasticsearch index                                    | undefined         |
| -d, --doc_type `<doc_type>`  | document type                                          | undefined         |
| -n, --number `<number>`      | number of documents to generate                        | 500               |
| -r, --random                 | generate random number of document up to `number`      | false             |

Also, there are some predefined values in `/genData/valueBank.json`.

## Step.3 start server for developing server side code
In the root directory of this repo, run:

```
GUPPY_PORT=3000 INTERNAL_LOCAL_TEST=true npm start
```

The Guppy server will be hosted at [localhost:3000/graphql](http://localhost:3000/graphql), now use Insomnia or Postman to play with it! 
We use nodemon to start the server, so all code change will be hot applied to the running server in realtime. 

## Step.4 start storybook for developing front-end components
In the root directory of this repo, run:

```
npm run storybook
```

[Storybook](https://storybook.js.org/) will be hosted at [localhost:6006](http://localhost:6006). 
