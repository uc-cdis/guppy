# Guppy

[![npm (scoped)](https://img.shields.io/npm/v/@gen3/guppy)](https://www.npmjs.com/package/@gen3/guppy)

Server that support GraphQL queries on data from elasticsearch. 

Please see [this doc](https://github.com/uc-cdis/guppy/blob/master/doc/queries.md) for syntax Guppy supports.

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
  "aggs_include_missing_data": true, // optional, by default true, this boolean decide whether elasticsearch aggregation should return missing data in result
  "missing_data_alias": "no data", // optional, only valid if `aggs_include_missing_data` is true, guppy will alias missing data into this keyword during aggregation. By default it's set to `no data`.
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

If not set, it would default to `http://arborist-service`. You could set it to `mock` to
skip all authorization steps. But if you just want to mock your own authorization
behavior for local test without Arborist, just set `INTERNAL_LOCAL_TEST=true`. Please
look into `/src/server/auth/utils.js` for more details.

#### Tier access
Guppy also support 3 different levels of tier access, by setting `TIER_ACCESS_LEVEL`: 
- `private` by default: only allows access to authorized resources
- `regular`: allows all kind of aggregation (with limitation for unauthorized resources), but forbid access to raw data without authorization
- `libre`: access to all data

For `regular` level, there's another configuration environment variable `TIER_ACCESS_LIMIT`, which is the minimum visible count for aggregation results.

`regular` level commons could also take in a whitelist of values that won't be encrypted. It is set by `config.encrypt_whitelist`.
By default the whitelist contains missing values: ['\_\_missing\_\_', 'unknown', 'not reported', 'no data'].
Also the whitelist is disabled by default due to security reasons. If you would like to enable whitelist, simply put `enable_encrypt_whitelist: true` in your config.
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
  "enable_encrypt_whitelist": true,
  "encrypt_whitelist": [ "do-not-encrypt-me" ]
}
```

For example following script will start a Guppy server with `regular` tier access level, and minimum visible count set to 100: 

```
export TIER_ACCESS_LEVEL=regular
export TIER_ACCESS_LIMIT=100
npm start
```

#### Download endpoint
Guppy has another special endpoint `/download` for just fetching raw data from elasticsearch. please see [here](https://github.com/uc-cdis/guppy/blob/master/doc/download.md) for more details.  
