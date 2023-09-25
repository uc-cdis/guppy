# Guppy Query Syntax

Table of Contents
- [Queries](#query)
- [Aggregations](#aggregation)
   - [Total Count Aggregation](#aggs-total)
   - [Text Aggregation](#aggs-text)
   - [Numeric Aggregation](#aggs-numeric)
   - [Nested Aggregation](#aggs-nested)
   - [Sub-aggregations](#aggs-sub)
   - [Cardinality Count Aggregation](#aggs-cardinality)
- [Filters](#filter)
   - [Basic Filter Unit](#filter-unit)
   - [Text Search Unit in Filter](#filter-search)
   - [Combined Filters](#filter-comb)
   - [Nested Filter](#filter-nested)
- [Some other queries and arguments](#other)

<a name="query"></a>

## Queries
Guppy allows you to query the raw data with offset, maximum number of rows, sorting and filters (see the end of the document for how filter syntax looks).

Example query:

```
{
  subject(offset: 5, first: 100, sort: [
    {
      "file_count": desc
    },
    {
      "gender": asc
    },
    {
      "experiments.experimental_description": asc
    }
  ], filter: $filter, format: JSON) {
    subject_id
    gender
    ethnicity
    vital_status
    file_count
    experiments {
      experimental_description
      number_experimental_group
      type_of_sample
      type_of_data
    }
  }
}
```

Example result:

```
{
  "data": {
    "subject": [
      {
        "subject_id": "9",
        "gender": "female",
        "ethnicity": "American Indian",
        "vital_status": "no data",
        "file_count": 13,
        "experiments": [
          {
            "experimental_description": "experiment for fun",
            "number_experimental_group": 1,
            "type_of_sample": "story",
            "type_of_data": "text"
          },
          {
            "experimental_description": "experiment for horror",
            "number_experimental_group": 2,
            "type_of_sample": "mv",
            "type_of_data": "text"
          }
        ]
      },
      {
        "subject_id": "12",
        "gender": "male",
        "ethnicity": "Pacific Islander",
        "vital_status": "Alive",
        "file_count": 60,
        "experiments": [
          {
            "experimental_description": "experiment for fun",
            "number_experimental_group": 1,
            "type_of_sample": "story",
            "type_of_data": "text"
          },
          {
            "experimental_description": "experiment for horror",
            "number_experimental_group": 2,
            "type_of_sample": "mv",
            "type_of_data": "text"
          }
        ]
      },
      {
        "subject_id": "13",
        "gender": "male",
        "ethnicity": "__missing__",
        "vital_status": "Dead",
        "file_count": 88,
        "experiments": [
          {
            "experimental_description": "experiment for fun",
            "number_experimental_group": 1,
            "type_of_sample": "story",
            "type_of_data": "text"
          },
          {
            "experimental_description": "experiment for horror",
            "number_experimental_group": 2,
            "type_of_sample": "mv",
            "type_of_data": "text"
          }
        ]
      },
      ...
    ]
  }
}
```

Arguments:

| argument      | description                                                     | type                                | default |
|---------------|-----------------------------------------------------------------|-------------------------------------|---------|
| offset        | starting position of query result                               | integer                             | 0       |
| first         | return rows of query result                                     | integer                             | 10      |
| sort          | sort method for query result                                    | JSON                                | {}      |
| format        | downloadable file format type for query result (see [format](#format) section) | ENUM: json, csv, tsv   | json    |
| [accessibility](#accessibility) | only valid for "regular" mode, return result by accessible type | ENUM: all, accessible, unaccessible | all     |
| [filter](#filter)        | filter object to apply for query                                | JSON                                | {}      |


<a name="aggregation"></a>

## Aggregations
Aggregation query is wrapped within `_aggregation` keyword. Three possible aggregations available:

<a name="aggs-total"></a>

### 1. Total count aggregation
 By using `_totalCount` keyword, return total count of the result.
 Can also use `_totalCount` keyword inside text aggregation to get [value count](https://www.elastic.co/guide/en/elasticsearch/reference/8.7/search-aggregations-metrics-valuecount-aggregation.html) of text aggregation

 Example:

 ```
 query ($filter: JSON) {
  _aggregation  {
    subject(filter: $filter) {
      _totalCount
    }
  }
}
```

Example result:

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "_totalCount": 46
      }
    }
  }
}
```

Text Aggregation Example:

 ```
 query ($filter: JSON) {
  _aggregation  {
    subject(filter: $filter) {
      subject_id {
        _totalCount
      }
    }
  }
}
```

Example result:

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "subject_id": {
          "_totalCount": 42
        }
      }
    }
  }
}
```

<a name="aggs-text"></a>

### 2. Text aggregation
Text aggregation returns histogram for a text field, results are wrapped by keywords `key` and `count`, example:

```
query {
  _aggregation {
    subject {
      gender {
        histogram {
          key
          count
        }
      }
    }
  }
}
```

Example result:

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "gender": {
          "histogram": [
            {
              "key": "female",
              "count": 46
            },
            {
              "key": "male",
              "count": 54
            }
          ]
        }
      }
    }
  }
}
```

<a name="aggs-numeric"></a>

### 3. Numeric aggregation
For numeric field, aggregation can calculate ***statistical summary*** or ***histogram***.

***Statistical summary*** includes minimum, maximum, average, sum and count for the data. Example:

```
query($filter: JSON) {
  _aggregation {
    subject(filter: $filter) {
      file_count {
        histogram{
          min
          max
          avg
          sum
          count
        }
      }
    }
  }
}
```

Result:
```
{
  "data": {
    "_aggregation": {
      "subject": {
        "file_count": {
          "histogram": [
            {
              "min": 0,
              "max": 93,
              "avg": 43,
              "sum": 1978,
              "count": 46
            }
          ]
        }
      }
    }
  }
}
```

***Histogram***  could be built by 2 methods: giving bin width, or giving bin counts.

 - Giving "bin width" means giving start and end value of histogram, and giving a step as bin width:

| argument   | description                 | type             | default   |
|------------|-----------------------------|------------------|-----------|
| rangeStart | starting value of histogram | integer or float | min value |
| rangeEnd   | ending value of histogram   | integer or float | max value |
| rangeStep  | step for each histogram bin | integer or float | max - min |

Example:

```
query($filter: JSON) {
  _aggregation {
    subject(filter: $filter) {
      file_count {
        histogram(rangeStart: 0, rangeEnd: 40, rangeStep: 5) {
          key
          min
          max
          avg
          sum
          count
        }
      }
    }
  }
}
```

Result:

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "file_count": {
          "histogram": [
            {
              "key": [
                0,
                5
              ],
              "min": 0,
              "max": 3,
              "avg": 1.5,
              "sum": 6,
              "count": 4
            },
            {
              "key": [
                5,
                10
              ],
              "min": 6,
              "max": 7,
              "avg": 6.666666666666667,
              "sum": 20,
              "count": 3
            },
            ...
          ]
        }
      }
    }
  }
}
```

 - Giving "bin count" means telling Guppy how many bins the histogram should be divided to:

| argument   | description                 | type             | default   |
|------------|-----------------------------|------------------|-----------|
| rangeStart | starting value of histogram | integer or float | min value |
| rangeEnd   | ending value of histogram   | integer or float | max value |
| binCount   | how many bins in histogram  | integer          | 1         |

Example:

```
query {
  _aggregation {
    subject{
      file_count {
        histogram (binCount: 3) {
          key
          count
        }
      }
    }
  }
}
```

Result:

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "file_count": {
          "histogram": [
            {
              "key": [
                1,
                34
              ],
              "count": 19
            },
            {
              "key": [
                34,
                67
              ],
              "count": 28
            },
            {
              "key": [
                67,
                100
              ],
              "count": 23
            }
          ]
        }
      }
    }
  }
}
```

<a name="aggs-nested"></a>

### 4. Nested Aggregation
:bangbang: **This section is for performing aggregations on documents which contain nested fields. For information about Guppy supporting nested sub-aggregations such as terms aggregation and missing aggregation, please refer to [Sub-aggregations](#aggs-sub)**

>The difference between Nested Aggregations and Sub-aggregations is that Nested Aggregations are performed on multi-level nested fields, while the sub-aggregations are performed on different fields within a same level.

Guppy supports performing aggregations (both text and numeric aggregations) on nested fields. For information about using nested fields inside filters, see [Nested Filter](#filter-nested)
> Suppose the ES index has a mapping as the following:
>```
>   "mappings": {
>     "subject": {
>       "properties": {
>         "subject_id": { "type": "keyword" },
>         "visits": {
>           "type": "nested",
>           "properties": {
>             "days_to_visit": { "type": "integer" },
>             "visit_label": { "type": "keyword" },
>             "follow_ups": {
>               "type": "nested",
>               "properties": {
>                 "days_to_follow_up": { "type": "integer" },
>                 "follow_up_label": { "type": "keyword" },
>               }
>             }
>           }
>         },
>       }
>     }
>    }
>```

An example nested query that Guppy can perform with respect to that ES index could be:
```
query: {
  _aggregation: {
    subject: {
      subject_id: {                    --> regular non-nested aggregation
        histogram: {
          key
          count
        }
      }
      visits: {
        visit_label: {                 --> one-level nested text aggregation
          histogram: {
            key
            count
          }
        }
        follow_ups: {
          days_to_follow_up: {         --> two-level nested numeric aggregation
            histogram(rangeStep: 1) {
              key
              count
            }
          }
        }
      }
    }
  }
}
```

Result:
```
{
  "data": {
    "_aggregation": {
      "subject": {
        "subject_id": {
          "histogram": [
            {
              "key": "subject_id_1",
              "count": 24
            },
            {
              "key": "subject_id_2",
              "count": 24
            },
            {
              "key": "subject_id_3",
              "count": 21
            }
          ]
        },
        "visits": {
          "visit_label": {
            "histogram": [
              {
                "key": "vst_lbl_3",
                "count": 29
              },
              {
                "key": "vst_lbl_1",
                "count": 21
              },
              {
                "key": "vst_lbl_2",
                "count": 19
              }
            ]
          },
          "follow_ups": {
            "days_to_follow_up": {
              "histogram": [
                {
                  "key": [
                    1,
                    2
                  ],
                  "count": 21
                },
                {
                  "key": [
                    2,
                    3
                  ],
                  "count": 19
                },
                {
                  "key": [
                    3,
                    4
                  ],
                  "count": 29
                }
              ]
            }
          }
        }
      }
    }
  }
}
```


<a name="aggs-sub"></a>

### 5. Sub-aggregations
:warning: **This section is for performing sub-aggregations (terms and missing aggregations) on documents. This section was incorrectly named as "Nested Aggregation" before Guppy 0.5.0 and has been corrected since then.**

Guppy supports sub-aggregations for fields. Currently Guppy only supports two-level-sub-aggregations.

There are two types of sub-aggregations that is supported by Guppy: terms aggregation and missing aggregation, user can mix-and-match the using of both aggregations.

For more information about ES terms aggregation and missing aggregation, please read: [Terms Aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html) and [Missing Aggregation](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-missing-aggregation.html)

> For examples in the following sections, assume the ES index has a mapping as the following:
>```
>   "mappings": {
>     "subject": {
>       "properties": {
>         "project": { "type": "keyword" },
>         "gender": { "type": "keyword" },
>         },
>       }
>    }
>```

#### 5.1. Terms Aggregation
Terms aggregation requires a single `field` for parent aggregation and an array of fields for the nested sub-aggregations. The sub-aggregations will be computed for the buckets which their parent aggregation generates. It is intended to show for each of the `key` of the single `field` in the parent aggregation, what is the distribution of each element from the array of fields in the sub-aggregations.

Results are wrapped by keywords `field` and also `key` and `count` for that `field`, example:

```
query ($nestedAggFields: JSON) {
  _aggregation {
  subject (nestedAggFields: $nestedAggFields) {
    project {
      histogram {
        key
        count
        termsFields {
          field
          terms {
            key
            count
          }
        }
      }
    }
  }
}
```

This query requires a `JSON` format variable `nestedAggFields`, which contains an array of `termsFields`. For example:

```
{
  nestedAggFields: {
    termsFields: [
      gender,
      someNonExistingField
    ]
  }
}
```

Result:

- Here `internal-test-1` and `internal-test-2` are example values of field `project`.

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "project": {
          "histogram": [
            {
              "key": "internal-test-1",
              "count": 41,
              "termsFields": [
                {
                  "field": "gender",
                  "terms": [
                    {
                      "key": "male",
                      "count": 22
                    },
                    {
                      "key": "unknown",
                      "count": 10
                    },
                    {
                      "key": "female",
                      "count": 9
                    }
                  ]
                },
                {
                  "field": "someNonExistingField",
                  "terms": [
                    {
                      "key": null,
                      "count": 0
                    }
                  ]
                }
              ]
            },
            {
              "key": "internal-test-2",
              "count": 35,
              "termsFields": [
                {
                  "field": "gender",
                  "terms": [
                    {
                      "key": "male",
                      "count": 13
                    },
                    {
                      "key": "female",
                      "count": 11
                    },
                    {
                      "key": "unknown",
                      "count": 11
                    }
                  ]
                },
                {
                  "field": "someNonExistingField",
                  "terms": [
                    {
                      "key": null,
                      "count": 0
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    }
  }
}
```

#### 5.2. Missing Aggregation
Missing aggregation also requires a single `field` for parent aggregation and an array of fields for the nested sub-aggregations. The sub-aggregations will be computed for the buckets which their parent aggregation generates. It is intended to show for each of the `key` of the single `field` in the parent aggregation, how many elements from the array of fields in the sub-aggregation are missing from it.

Results are wrapped by keywords `field` and `count`, example:

```
query ($nestedAggFields: JSON) {
  _aggregation {
  subject (nestedAggFields: $nestedAggFields) {
    project {
      histogram {
        key
        count
        missingFields {
          field
          count
        }
      }
    }
  }
}
```

This query requires a `JSON` format variable `nestedAggFields`, which contains an array of `missingFields`. For example:

```
{
  nestedAggFields: {
    missingFields: [
      gender,
      someNonExistingField
    ]
  }
}
```

Result:

- Here `internal-test-1` and `internal-test-2` are example values of field `project`.

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "project": {
          "histogram": [
            {
              "key": "internal-test-1",
              "count": 41,
              "missingFields": [
                {
                  "field": "gender",
                  "count": 0
                },
                {
                  "field": "someNonExistingField",
                  "count": 41
                }
              ]
            },
            {
              "key": "internal-test-2",
              "count": 35,
              "missingFields": [
                {
                  "field": "gender",
                  "count": 0
                },
                {
                  "field": "someNonExistingField",
                  "count": 35
                }
              ]
            }
          ]
        }
      }
    }
  }
}
```

<a name="aggs-cardinality"></a>

### 6. Cardinality Count Aggregation
 By using `_cardinalityCount` keyword, return a cardinality count of a field.

 See [Elasticsearch documentation on Cardinality](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-metrics-cardinality-aggregation.html)

> **Note**
> curenntly does not support nested feilds

 Example:

 ```
 query ($filter: JSON) {
  _aggregation  {
    subject(filter: $filter) {
      submitter_id {
        _cardinalityCount(
          precision_threshold: 1000 //optional defaults to 3000
        )
      }
    }
  }
}
```

Example result:

```
{
	"data": {
		"_aggregation": {
			"subject": {
				"submitter_id": {
					"_cardinalityCount": 98
				}
			}
		}
	}
}
```

<a name="filter"></a>

## Filters

<a name="filter-unit"></a>

### Basic filter unit
Currently Guppy uses `JSON`-based syntax for filters.
The JSON object key could be an operation like `=`, `>`.
A very basic filter unit would look like: `{<operater>: {<field_name> : <value_expression>}}`.
One simple example could look like:

```
{
  "filter": {
    "=": {
      "subject_id": "sbj_69"
    }
  }
}
```


Currently we support following operators:


| operator     | meaning                  | support field type | example                                                          |
|--------------|--------------------------|--------------------|------------------------------------------------------------------|
| eq, EQ, =    | equal                    | string, number     | {"eq": {"gender": "female"}}                                     |
| in, IN       | inside                   | string, number     | {"in": {"gender": ["female", "F"]}}                              |
| !=           | is not                   | string, number     | {"!=": {"gender": "male"}}                                       |
| gt, GT, >    | greater than             | number             | {">": {"age": 50}}                                               |
| gte, GTE, >= | greater than or equal to | number             | {">=": {"age": 50}}                                              |
| lt, LT, <    | less then                | number             | {"<": {"age": 50}}                                               |
| lte, LTE, <= | less than or equal to    | number             | {"<=": {"age": 50}}                                              |
| search       | [search text](#filter-search)              | text               | {"search": {"keyword": "asian","fields": ["race", "ethnicity"]}} |



<a name="filter-search"></a>

### A search unit in filter
You could add a search unit into your filter, the syntax looks like:

```
{
  "search": {
    "keyword": <any text to search>,
    "fields": <a list of fields for search>
  }
}
```

Notice that `keyword` is required. But `fields` is optional,
and if not set, guppy will search thru all analyzed text fields that matched the suffix pattern set in `ANALYZED_TEXT_FIELD_SUFFIX` (by default `.analyzed`, which means search thru all `*.analyzed` fields).

#### Matched results and highlights
Guppy will return matched fields and highlight partial in `_matched` keyword,
with the matched field name, and highlighted partial words wrapped inside `<em>` tags.
A example search filter:

```
query ($filter: JSON) {
  subject (filter: $filter, first: 20) {
    gender
    race
    ethnicity
    _matched {
      field
      highlights
    }
  }
}
```

with variable:

```
{
  "filter": {
      "search": {
        "keyword": "asia",
        "fields": "race"
      }
  }
}
```

example result:

```
{
  "data": {
    "subject": [
      {
        "gender": "female",
        "race": "asian",
        "ethnicity": "__missing__",
        "_matched": [
          {
            "field": "race",
            "highlights": [
              "<em>asia</em>n"
            ]
          }
        ]
      },
      {
        "gender": "male",
        "race": "asian",
        "ethnicity": "White",
        "_matched": [
          {
            "field": "race",
            "highlights": [
              "<em>asia</em>n"
            ]
          }
        ]
      },
      ...
    ]
  }
}
```




<a name="filter-comb"></a>

### Combine into advanced filters
You could use binary combination (`AND` or `OR`) to combine simple filter units into more complicated big filters. Example:

```
{
  "filter": {
    "AND": [
      {
        "OR": [
          {
            "=": {
              "race": "hispanic"
            }
          },
          {
            "=": {
              "race": "asian"
            }
          }
        ]
      },
      {
        "AND": [
          {
            ">=": {
              "file_count": 15
            }
          },
          {
            "<=": {
              "file_count": 75
            }
          }
        ]
      },
      {
        "=": {
          "project": "Proj-1"
        }
      },
      {
        "=": {
          "gender": "female"
        }
      }
    ]
  }
}
```

In future Guppy will support `SQL` like syntax for filter, like `
{"filter": "(race = 'hispanic' OR race='asian') AND (file_count >= 15 AND file_count <= 75) AND project = 'Proj-1' AND gender = 'female'"}
`.

<a name="filter-nested"></a>

### Nested filter
Guppy now supports query on nested ElasticSearch schema. The way to query and filter the nested index is similar to the ES query.
Assuming that there is `File` node nested inside `subject`. The nested query will be written as below:
```
{
  "filter": {
    "AND": [
      {
        "OR": [
          {
            "=": {
              "race": "hispanic"
            }
          },
          {
            "=": {
              "race": "asian"
            }
          }
        ]
      },
      {
        "nested": {
          "path": "File",
          "AND": [
            {
              ">=": {"file_count": 15}
            },
            {
              "<=": {"file_count": 75}
            }
          ]
        }
      }
    ]
  }
}
```

ElasticSearch only support the nested filter on the level of document for returning data. It means that the filter `file_count >=15` and `file_count<=75` will return the whole document having a `file_count` in the range of `[15, 75]`.
The returned data will not filter the nested `file_count`(s) that are out of that range for that document.
If the ES document has multi-level nested field, just update the `path` value.
Example:
```
{
  "filter": {
    "AND": [
      ...
      {
        "nested": {
          "path": "visits.follow_ups",
          "AND": [
            {
              ">=": {"days_to_follow_up": 15}
            }
          ]
        }
      }
    ]
  }
}
```

<a name="other"></a>
## Some other queries and arguments

### Mapping query
Mapping query simply returns all fields under a doc type. Example:
```
{
  _mapping {
    file
    subject
  }
}
```

Result:

```
{
  "data": {
    "_mapping": {
      "file": [
        "file_id",
        "gen3_resource_path",
        "subject_id"
      ],
      "subject": [
        "ethnicity",
        "file_count",
        "file_format",
        "file_type",
        "gen3_resource_path",
        "gender",
        "name",
        "project",
        "race",
        "some_integer_field",
        "some_string_field",
        "study",
        "subject_id",
        "vital_status",
        "whatever_lab_result_value"
      ]
    }
  }
}
```

<a name="accessibility"></a>

### "accessibility" argument for "regular" tier access level
When choose "regular" mode for for tier access level, `accessibility` argument will be valid for raw data or aggregation query. It support 3 enum values: `all`, `accessible`, and `unaccessible`. And will return data by those three accessibility types. By default it is set to `all`.  Below are the different behaviors for each enum value.

| enum         | description                | when query raw data                                                                                                  | when query aggregation                                                                                                                                |
|--------------|----------------------------|----------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| all          | return all aggregation     | If response data contains any resources that user doesn't have access to, return 401.  Otherwise return result data. | Returns aggregation result. Maximum visible number may apply according to `TIER_ACCESS_LIMIT`, if there's resources that user doesn't have access to. |
| accessible   | return aggregation for accessible data  | Only returns data that user has access to.                                                                           | Only returns aggregation result that user has access to.                                                                                              |
| unaccessible | return aggregation for unaccessible data | Always returns 401                                                                                                   | Returns aggregation result.Maximum visible number may apply according to `TIER_ACCESS_LIMIT`                                                          |

Example 1 (trying to get raw data for unaccessible resources is forbidden):
```
query  {
  subject (accessibility: unaccessible) {
    gender
  }
}
```

Result:
```
{
  "errors": [
    {
      "message": "You don't have access to all the data you are querying. Try using 'accessibility: accessible' in your query",
      "locations": [
        {
          "line": 2,
          "column": 3
        }
      ],
      "path": [
        "subject"
      ],
      "extensions": {
        "code": 401,
        "exception": {
          "stacktrace": [
            "Error: You don't have access to all the data you are querying. Try using 'accessibility: accessible' in your query",
      ...
}
```

Example 2 (trying to get aggregation for unaccessible resources):

```
query  {
  _aggregation {
    subject(accessibility: unaccessible) {
      project {
        histogram {
          key
          count
        }
      }
    }
  }
}
```

Result:
```
{

  "data": {
    "_aggregation": {
      "subject": {
        "project": {
          "histogram": [
            {
              "key": "external-test",
              "count": 30
            }
          ]
        }
      }
    }
  }
}
```

### Tiered Access Sensitive Record Exclusion
It is possible to configure Guppy to hide some records from being returned in `_aggregation` queries when Tiered Access is enabled (tierAccessLevel: "regular").
The purpose of this is to "hide" information about certain sensitive resources, essentially making this an escape hatch from Tiered Access. Specifically, this feature is used in a Gen3 data commons to hide the existence of some studies from clients who do not have access, while keeping the features of Tiered Access for the non-sensitive studies.

Crucially, Sensitive Record Exclusion only applies to records which the user does not have access to. If the user has access to a record, it will
be counted in the aggregation query whether or not it is sensitive.

To enable Sensitive Record Exclusion, set  `guppy.tier_access_sensitive_record_exclusion_field: "fieldname"` in the commons' `manifest.json`. `"fieldName"` should match a boolean field in the Elasticsearch index that indicates whether or not a record is sensitive.
(E.g., `"tier_access_sensitive_record_exclusion_field": "sensitive"` in the Guppy config tells Guppy to look for a field in the ES index called `sensitive`, and to exclude records in the ES index which have `sensitive: "true"`)


> Example: We have a index called "subject" with `100` records in it. Of those, `55` are inaccessible to this user.
Of the inaccessible records, `15` records are sensitive. There are also `5` other sensitive records which are accessible to the user.
>
> __What will Guppy return when we ask for a total count of all records in the index?__
> ```
> query {
>   _aggregation{
>     $indexName(accessibility: all) {
>       _totalCount
>     }
>   }
> }
>```
> * Expected output:
> ```
> {
>     "data": {
>         "_aggregation": {
>             "$indexName": {
>                 "_totalCount": 85
>             }
>         }
>     }
> }
>```
> If sensitive study exclusion is enabled, Guppy will return `85`, instead of `100`. This is because Guppy excludes the `15` sensitive records that are not accessible to the user. Importantly, Guppy does not exclude the `5` sensitive records which are accessible to the user.
>
### `filterSelf`
In some UI scenarios, there's need that aggregation should skip applying filters on those fields that appear in filter object. For example, in Guppy's filter UI component, when user select `gender=female`, the aggregation (with filter object include `gender=female`) should return all gender values including "female", "male", and "unknown" etc., because filter UI still need to render those options.

In order to skip applying filters for those fields, simply add `filterSelf=false`.

Example without setting `filterSelf` (default is `true`):
```
query {
  _aggregation {
    subject(filter: { eq: { gender: "female" } }) {
      gender {
        histogram {
          key
          count
        }
      }
    }
  }
}
```

Result:

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "gender": {
          "histogram": [
            {
              "key": "female",
              "count": 24
            }
          ]
        }
      }
    }
  }
}
```

Example with `filterSelf: false`:

```
query {
  _aggregation {
    subject(filterSelf: false, filter: { eq: { gender: "female" } }) {
      gender {
        histogram {
          key
          count
        }
      }
    }
  }
}
```

Result:

```
{
  "data": {
    "_aggregation": {
      "subject": {
        "gender": {
          "histogram": [
            {
              "key": "unknown",
              "count": 28
            },
            {
              "key": "female",
              "count": 24
            },
            {
              "key": "male",
              "count": 18
            }
          ]
        }
      }
    }
  }
}
```

<a name="format"></a>

## Format
To support multiple downloadable file formats for Explorer, there is a `format` arg (see [Queries](#queries) above)
where a file type is passed into Guppy. Currently, there is support for downloads to TSV, CSV, and JSON. Due to current Graphql
restrictions, the `format` arg is used to supply the file type to the Conversion Service, the service then converts the JSON returned
from Guppy. The Query Page *only* returns JSON. See `TECHDEBT.md` for more details.
