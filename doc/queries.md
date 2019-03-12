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
  subject(offset: 5, size: 100, sort: [
    {
      "_samples_count": desc
    },
    {
      "gender": asc
    }
  ], filter: $filter) {
    id
    gender
    ethnicity
    _samples_count
  }
}
</pre>
</td>
<td>
<pre>
{
  "subject": [
    {
      "id": "1",
      "gender": "F",
      "ethnicity": "",
      "_samples_count": 0
    },
    {
      "id": "2",
      "gender": "M",
      "ethnicity": "",
      "_samples_count": 0
    },
    {
      "id": "3",
      "gender": "F",
      "ethnicity": "",
      "_samples_count": 0
    }
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
{
  aggs(filter: $filter) {
    subject {
      total
    }
    gender {
      histogram {
        key
        count
      }
    }
    age {
      histogram(rangeStart: 0, rangeEnd: 40, rangeStep: 5) {
        _range
        min
        max
        avg
        sum
        count
      }
    }
  }
}
</pre>
</td>
<td>
<pre>
{
    "aggs": {
        "subject": {
            "total": 3
        },
        "gender": {
          "histogram": [
            {
              "key": "F",
              "count": 10
            },
            {
              "key": "M",
              "count": 10
            }
          ]
        },
        "age": {
            "histogram": [
              {
                "_range": [0, 5],
                "min": 2
              },
              {
                "_range": [5, 10],
                "min": 3
              },
              ...
            ]
        }
    }
}
</pre>
</td>
</tr>
<tr>
<td>
<pre>
{
  aggs(filter: $filter) {
    age {
      histogram {
        min
        max
        avg
        sum
        count
      }
    }
  }
}
</pre>
</td>
<td>
<pre>
{
    "aggs": {
        "age": {
            "histogram": [
              {
                "min": 2,
                "max": 10,
                "avg": 24.4,
                "sum": 25,
                "count": 3
              }
            ]
        }
    }
}
</pre>
</td>
</tr>
<tr>
<td>
<pre>
{
  aggs(filter: $filter) {
    age {
      histogram (binCount: 20) {
        _range
        avg
        count
      }
    }
  }
}
</pre>
</td>
<td>
<pre>
{
    "aggs": {
        "age": {
            "histogram": [
              {
                "_range": [0, 5]
                "avg": 4.4,
                "count": 4
              },
              {
                "_range": [5, 10]
                "avg": 7.6,
                "count": 9
              },
              ...
            ]
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
