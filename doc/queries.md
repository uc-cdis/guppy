# Guppy Query Syntax

Table of Contents
- [Queries](#query)
- [Aggregations](#aggregation)
   - [Total Count Aggregation](#aggs-total)
   - [Text Aggregation](#aggs-text)
   - [Numeric Aggregation](#aggs-numeric)
   - [Nested Aggregation](#aggs-nested)
- [Filters](#filter)
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
    }
  ], filter: $filter) {
    subject_id
    gender
    ethnicity
    vital_status
    file_count
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
        "file_count": 13
      },
      {
        "subject_id": "12",
        "gender": "male",
        "ethnicity": "Pacific Islander",
        "vital_status": "Alive",
        "file_count": 60
      },
      {
        "subject_id": "13",
        "gender": "male",
        "ethnicity": "__missing__",
        "vital_status": "Dead",
        "file_count": 88
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
| [accessibility](#accessibility) | only valid for "regular" mode, return result by accessible type | ENUM: all, accessible, unaccessible | all     |
| [filter](#filter)        | filter object to apply for query                                | JSON                                | {}      |


<a name="aggregation"></a>

## Aggregations 
Aggregation query is wrapped within `_aggregation` keyword. Three possible aggregations available: 

<a name="aggs-total"></a>

### 1. Total count aggregation 
 By using `_totalCount` keyword, return total count of the result. Example:

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
Guppy supports nested aggregations (sub-aggregations) for fields. Currently Guppy only supports two-level-sub-aggregations.

There are two types of nested aggregations that is supported by Guppy: terms aggregation and missing aggregation, user can mix-and-match the using of both aggregations.

#### 4.1. Terms Aggregation
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

#### 4.2. Missing Aggregation
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

<a name="filter"></a>

## Filters 
Currently Guppy uses `JSON`-based syntax for filters. The JSON object key could be an operation like `=`, `>`. One simple example could be:

```
{
  "filter": {"=": {"subject_id": "69"}}
}
```

Or you could use binary combination (`AND` or `OR`)to combine simple filter units into more complicated big filters. Example:

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
      "message": "You don't have access to following resources:         [/programs/external/projects/test]",
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
            "Error: You don't have access to following resources:         [/programs/external/projects/test]",
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

