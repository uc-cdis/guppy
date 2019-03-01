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
<td colspan="2">Three possible aggregations available: top-level aggregation - only total number; text aggregation - buckets for key and count for that key; numeric aggregation - minimum, maximum, average, sum and count for the whole dataset and for the buckets specified by <code>rangestep</code>. Without <code>rangestep</code> it aggregates the whole dataset.</td>
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
      buckets {
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
            "buckets": [
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
</tbody>
</table>

## Filters

There is a discussion of two approaches:

* `JSON`-based syntax
  ```
  {
    "filter": 
    {
      "and": [
        {"Gender": "F"},
        {
          "and": [
            {
              "or": [
                {"Age": {"gte": 27}},
                {"Age": 15}
              ]
            },
            {"_samples_count": {"gt": 12}}
          ]
        }
      ]
    }
  }
  ```

* `SQL`-like syntax
  ```
  {"filter": "Gender = "F" AND ((Age >= 27 OR Age = 15) AND _samples_count > 12)"}
  ```
The implementation is relatively more difficult (to parse SQL string to object). But in future we want to support having a SQL-like syntax query in UI, so it is very rewarding.


## Discussion
