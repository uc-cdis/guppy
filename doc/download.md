# Guppy Download Endpoint
Guppy has another special endpoint `/download` for just fetching raw data from elasticsearch.

The main difference between this `/download` endpoint and normal GraphqlQL raw data query is that the endpoint's implementation is hitting elasticsearch's scroll API to avoid the 10k row limitation of elasticsearch. This is quite useful when the data scale is over 10k rows. 

Currently we support following arguments for `/download` endpoint: 

| argument      | required | description                                                                     | type                                                                                              | default                                                                                                                                                                              |
|---------------|----------|---------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| type          | yes      | which data type to download from                                                | string                                                                                            |                                                                                                                                                                                      |
| filter        | no       | filter to apply                                                                 | object, see [here](https://github.com/uc-cdis/guppy/blob/master/doc/queries.md#filter) for syntax | none                                                                                                                                                                                 |
| sort          | no       | with what sort method                                                           | object                                                                                            | none                                                                                                                                                                                 |
| fields        | no       | which fields to download                                                        | array of string                                                                                   | if not set, will return all fields                                                                                                                                                   |
| accessibility | no       | only valid when using "regular" tier access mode. With which accessibility type | enum: accessible, unaccessible, all                                                               | for "regular" tier access mode, by default is "all". So in this "regular" mode if user tries to download data containing external resources, the endpoint will return 401 forbidden. |


Example request body: 

```
{
	"type": "subject",
	"fields": [
		"gender", 
		"race",
		"file_count",
		"subject_id",
    "visit.visit_label"
	],
	"sort": [
		{ "file_count": "asc" },
		{ "gender": "desc" },
    { "visit.visit_label": "asc" }
	]
}
```

Example result: 

```
[
  {
    "subject_id": "78",
    "file_count": 1,
    "gender": "female",
    "race": "hispanic",
    "visit": [
      {
        "visit_label": "label_1"
      },
      {
        "visit_label": "label_2"
      }
    ]
  },
  {
    "subject_id": "45",
    "file_count": 3,
    "gender": "female",
    "race": "hispanic",
    "visit": [
      {
        "visit_label": "label_3"
      },
      ...
    ]
  },
  {
    "subject_id": "60",
    "file_count": 5,
    "gender": "female",
    "race": "asian",
    "visit": [
      {
        "visit_label": "label_X"
      },
      ...
    ]
  },
  {
    "subject_id": "58",
    "file_count": 13,
    "gender": "male",
    "race": "white",
    "visit": [
      {
        "visit_label": "label_Y"
      },
      ...
    ]
  },
  ...
]
```
