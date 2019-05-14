# Guppy

Server that support GraphQL queries on data from elasticsearch. 

Run `npm start` to start server at port 80. 

### Configurations: 
Before launch, we need to write config and tell Guppy which elasticsearch indices and which auth control field to use. 
You could put following as your config files: 

```
{
  "indices": [
    {
      "index": "${ES_INDEX_1}",
      "type": "${ES_DOC_TYPE_1}"
    },
    {
      "index": "${ES_INDEX_2}",
      "type": "${ES_DOC_TYPE_2}"
    },
    ...
  ],
  "config_index": "${ES_ARRAY_CONFIG}", // optional, if there's array field, Guppy read the configs from this index.
  "auth_filter_field": "${AUTH_FILTER_FIELD}",
}
```

Following script will start server using at port 3000, using config file `example_config.json`: 

```
export GUPPY_PORT=3000
export GUPPY_CONFIG_FILEPATH=./example_config.json
npm start
```

#### Authorization
Guppy connects Arborist for authorization. 
The `auth_filter_field` item in your config file is the field used for authorization. 
You could set the endpoint by: 

```
export GEN3_ARBORIST_ENDPOINT=${arborist_service}
```

If not set, Guppy will skip all authorization steps as default. 
But if you just want to mock your own authorization behavior for local test without Arborist, just set `INTERNAL_LOCAL_TEST=true`. 
Please look into `/src/server/utils/accessibilities.js` for more details. 

#### Tier access
Guppy also support 3 different levels of tier access, by setting `TIER_ACCESS_LEVEL`: 
- `private` by default: only allows access to authorized resources
- `regular`: allows all kind of aggregation (with limitation for unauthorized resources), but forbid access to raw data without authorization
- `libre`: access to all data

For `regular` level, there's another configuration environment variable `TIER_ACCESS_LIMIT`, which is the minimum visible count for aggregation results.

`regular` level commons could also take in a whitelist of values that won't be encrypted. It is set by `config.encrypt_whitelist`. 
For example `regular` leveled commons with config looks like this will skip encrypting value `do-not-encrypt-me` even if its count is less than `TIER_ACCESS_LIMIT`: 

```
{
  "indices": [
    {
      "index": "gen3-dev-subject",
      "type": "subject"
    },
    {
      "index": "gen3-dev-file",
      "type": "file"
    }
  ],
  "config_index": "gen3-dev-config",
  "auth_filter_field": "gen3_resource_path",
  "encrypt_whitelist": [ "do-not-encrypt-me" ]
}
```

By default the whitelist contains missing values: ['\__missing\__', 'unknown', 'not reported', 'no data']. 
If you would like to disable whitelist, simply put `encrypt_whitelist: "disabled"` in your config.

For example following script will start a Guppy server with `regular` tier access level, and minimum visible count set to 100: 

```
export TIER_ACCESS_LEVEL=regular
export TIER_ACCESS_LIMIT=100
npm start
```
