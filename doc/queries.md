# Test

## Queries & Aggregations
<table>
<thead>
<tr>
<th>GraphQL query</th><th>Response</th>
</tr>
</thead>
<tbody>
<tr>
<td colspan="2">Query the raw data with offset, maximum number of rows, sorting and filters (see the end of the document).</td>
</tr>
<tr>
<td>
<pre>
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
</pre>
</td>
<td>
<pre>
{
  "subject": [
      {
        "subject_id": "52",
        "gender": "female",
        "ethnicity": "Black",
        "vital_status": "Alive",
        "file_count": 0
      },
      {
        "subject_id": "54",
        "gender": "female",
        "ethnicity": "American Indian",
        "vital_status": "Alive",
        "file_count": 78
      },
      {
        "subject_id": "55",
        "gender": "female",
        "ethnicity": "Pacific Islander",
        "vital_status": "Alive",
        "file_count": 53
      },
      ...
  ]
}
</pre>
</td>
</tr>
<tr>
<td colspan="2">Three possible aggregations available: 
  <li>
  top-level aggregation - only total number; 
  </li>
  <li>
  text aggregation - histogram for key and count for that key; 
  </li>
  <li>
  numeric aggregation - minimum, maximum, average, sum and count for the whole dataset and for the histogram specified by <code>rangeStart</code>, <code>rangeEnd</code>, <code>rangeStep</code>, and <code>binCount</code>. 
  <ul>
    <li><code>rangeStart</code> default to min, <code>rangeEnd</code> default to max. 
    <li>Without <code>rangeStep</code> and <code>binCount</code> it aggregates the whole dataset.</li>
    <li><code>binCount</code> and <code>rangeStep</code> are exclusive, user could only set one of them. </li>
  </ul>
  </li>
</td>
</tr>
<tr>
<td>
<pre>
query ($filter: JSON) {
  _aggregation  {
    subject(filter: $filter) {
      _totalCount
    }
  }
}
</pre>
</td>
<td>
<pre>
{
  "_aggregation": {
    "subject": {
      "_totalCount": 46
    }
  }
}
</pre>
</td>
</tr>
<tr>
<td>
<pre>
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
</pre>
</td>
<td>
<pre>
{
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
</pre>
</td>
</tr>
<tr>
<td>
<pre>
query($filter: JSON) {
  _aggregation {
    subject(filter: $filter) {
      file_count {
        histogram{
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

</pre>
</td>
<td>
<pre>
{
    "_aggregation": {
      "subject": {
        "file_count": {
          "histogram": [
            {
              "key": [
                0,
                93
              ],
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
</pre>
</td>
</tr>
<tr>
<td>
<pre>
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

</pre>
</td>
<td>
<pre>
{
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
</pre>
</td>
</tr>
<tr>
<td colspan="2">Query raw data or aggregation for different types
</td>
</tr>
<tr>
<td>
<pre>
{
  subject(offset: 5, first: 100, sort: $sort1, filter: $filter1) {
    subject_id
    gender
    ethnicity
    vital_status
    file_count
  }
  file (sort: $sort2, filter: $filter2){
    file_id
    subject_id
  }
}
</pre>
</td>
<td>
<pre>
{
  "subject": [
      {
        "subject_id": "52",
        "gender": "female",
        "ethnicity": "Black",
        "vital_status": "Alive",
        "file_count": 0
      },
      {
        "subject_id": "54",
        "gender": "female",
        "ethnicity": "American Indian",
        "vital_status": "Alive",
        "file_count": 78
      },
      {
        "subject_id": "55",
        "gender": "female",
        "ethnicity": "Pacific Islander",
        "vital_status": "Alive",
        "file_count": 53
      },
      ...
  ],
  "file": [
      {
        "file_id": "file_id_201",
        "subject_id": "42"
      },
      {
        "file_id": "file_id_25",
        "subject_id": "43"
      },
      {
        "file_id": "file_id_894",
        "subject_id": "44"
      },
      ...
  ]
}
</pre>
</td>
</tr>
<tr>
<td>
<pre>
{
  _aggregation {
    subject {
      gender {
        histogram {
          key
          count
        }
      }
    }
    file {
      file_id {
        histogram {
          key
          count
        }
      }
    }
  }
}

</pre>
</td>
<td>
<pre>
{
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
      },
      "file": {
        "file_id": {
          "histogram": [
            {
              "key": "file_id_105",
              "count": 1
            },
            {
              "key": "file_id_113",
              "count": 1
            },
            {
              "key": "file_id_135",
              "count": 1
            },
            ...
          ]
        }
      }
    }
}
</pre>
</td>
</tr>
</tbody>
</table>

## Filters

There is a discussion of two approaches:

* `JSON`-based syntax
  ```
  {
    "filter": {
      "AND": [
        {
          "OR": [
            {
              "=": [
                "race",
                "hispanic"
              ]
            },
            {
              "=": [
                "race",
                "asian"
              ]
            }
          ]
        },
        {
          "AND": [
            {
              ">=": [
                "file_count",
                15
              ]
            },
            {
              "<=": [
                "file_count",
                75
              ]
            }
          ]
        },
        {
          "=": [
            "project",
            "Proj-1"
          ]
        },
        {
          "=": [
            "gender",
            "female"
          ]
        }
      ]
    }
  }
  ```

* `SQL`-like syntax
  ```
  {"filter": "(race = 'hispanic' OR race='asian') AND (file_count >= 15 AND file_count <= 75) AND project = 'Proj-1' AND gender = 'female'"}
  ```
The implementation is relatively more difficult (to parse SQL string to object). But in future we want to support having a SQL-like syntax query in UI, so it is very rewarding.


## Discussion
