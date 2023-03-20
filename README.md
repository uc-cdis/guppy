# Guppy

[![npm (scoped)](https://img.shields.io/npm/v/@gen3/guppy?label=NPM%20Release%20%28Component%29)](https://www.npmjs.com/package/@gen3/guppy)
[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/uc-cdis/guppy?label=GH%20Release%20%28Server%29)](https://github.com/uc-cdis/guppy/releases)

Server that support GraphQL queries on data from elasticsearch.

Please see [this doc](https://github.com/uc-cdis/guppy/blob/master/doc/queries.md) for syntax Guppy supports.

Run `npm start` to start server at port 80.

### Local Deployment and Development:
Guppy has some helper script to help a developer to set up a local ES service using Docker, generate some example ES indices for testing, and pop mock data into these example ES indices. Please refer to [the DEV Helper doc](https://github.com/uc-cdis/guppy/blob/master/devHelper/README.md) for more information.

### Quickstart with Helm

You can now deploy individual services via Helm!
Please refer to the Helm quickstart guide HERE (https://github.com/uc-cdis/guppy/blob/master/doc/quickstart_helm.md)

### Configurations:
Before launch, we need to write config and tell Guppy which elasticsearch indices and which auth control field to use.
You could put following as your config files:

```
{
  "indices": [
    {
      "index": "${ES_INDEX_1}",
      "type": "${ES_DOC_TYPE_1}",
      "tier_access_level": "${ES_TIER_ACCESS_LEVEL_1}" // optional, set this if there is no global tierAccessLevel
    },
    {
      "index": "${ES_INDEX_2}",
      "type": "${ES_DOC_TYPE_2}",
      "tier_access_level": "${ES_TIER_ACCESS_LEVEL_2}"  // optional, set this if there is no global tierAccessLevel
    },
    ...
  ],
  "config_index": "${ES_ARRAY_CONFIG}", // optional, if there's array field, Guppy read the configs from this index.
  "auth_filter_field": "${AUTH_FILTER_FIELD}",
  "aggs_include_missing_data": true, // optional, by default true, this boolean decide whether elasticsearch aggregation should return missing data in result
  "missing_data_alias": "no data", // optional, only valid if `aggs_include_missing_data` is true, guppy will alias missing data into this keyword during aggregation. By default it's set to `no data`.
}
```

Note: Guppy expects that either all indices in the guppy config block will have a tier_access_level set OR that a site-wide TIER_ACCESS_LEVEL is set as an environment variable (or in the global block of a commons' manifest). Guppy will throw an error if the config settings do not meet one of these two expectations. See [doc/index_scoped_tiered_access.md](https://github.com/uc-cdis/guppy/blob/master/doc/index_scoped_tiered_access.md) for more information.

Following script will start server using at port 3000, using config file `example_config.json`:

```
export GUPPY_PORT=3000
export GUPPY_CONFIG_FILEPATH=./example_config.json
npm start
```

### Authorization:
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

### Tiered Access:
The tiered-access setting is configured through either the `TIER_ACCESS_LEVEL` environment variable or the `tier_access_level` properties on individual indices in the esConfig. Guppy supports 3 different levels of tiered access:
- `private` by default: only allows access to authorized resources
- `regular`: allows all kind of aggregation (with limitation for unauthorized resources), but forbid access to raw data without authorization
- `libre`: access to all data

For the `regular` level, there's another configuration environment variable `TIER_ACCESS_LIMIT`, which is the minimum visible count for aggregation results.

`regular` level commons can also take in a whitelist of values that won't be encrypted. It is set by `config.encrypt_whitelist`.
By default the whitelist contains missing values: ['\_\_missing\_\_', 'unknown', 'not reported', 'no data'].
Also the whitelist is disabled by default due to security reasons. If you would like to enable whitelist, simply put `enable_encrypt_whitelist: true` in your config.
For example, a `regular` leveled commons with config that looks like this will skip encrypting the value `do-not-encrypt-me` even if its count is less than `TIER_ACCESS_LIMIT`:

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

The following script will start a Guppy server with a site-wide `regular` tier access level, and minimum visible count set to 100:

```
export TIER_ACCESS_LEVEL=regular
export TIER_ACCESS_LIMIT=100
npm start
```

To learn how to configure Guppy's tiered-access system using a per-index scoping, and which use cases might warrant such a configuration, please see `doc/index_scoped_tiered_access.md`.

> #### Tier Access Sensitive Record Exclusion
> It is possible to configure Guppy to hide some records from being returned in `_aggregation` queries when Tiered Access is enabled (tierAccessLevel: "regular").
> The purpose of this is to "hide" information about certain sensitive resources, essentially making this an escape hatch from Tiered Access.
> Crucially, Sensitive Record Exclusion only applies to records which the user does not have access to. If the user has access to a record, it will
> be counted in the aggregation query whether or not it is sensitive.
>
> To enable Sensitive Record Exclusion, set  `guppy.tier_access_sensitive_record_exclusion_field: "fieldname"` in the commons' `manifest.json`. "fieldName" should match a boolean field in the Elasticsearch index that indicates whether or not a record is sensitive.
>
> (E.g., `"tier_access_sensitive_record_exclusion_field": "sensitive"` in the Guppy config tells Guppy to look for a field in the ES index called `sensitive`, and to exclude records in the ES index which have `sensitive: "true"`)

### Additional Guppy Endpoints:
Guppy has a special endpoint `/download` for just fetching raw data from elasticsearch. This endpoint can be used to overcome Elastic Search's 10k record limit. Please see [here](https://github.com/uc-cdis/guppy/blob/master/doc/download.md) for details.

Guppy's `/_status` endpoint yields health check and array field information. This endpoint is publicly accessible and returns output of the form
```
{"statusCode":200,"warnings":null,"indices":{"<index-name>":{"aliases":{"alias-name":{}},"arrayFields":["<name-of-array-field>"]}}}
```

The `/_version` endpoint yields version and commit information. This endpoint is publicly accessible and returns output of the form
```
{"version":"<version-string>","commit":"<commit-hash>"}
```
