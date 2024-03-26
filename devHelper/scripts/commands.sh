#!/bin/bash

export ESHOST=${GEN3_ES_ENDPOINT:-"localhost:9200"}

#
# Delete all the indexes out of ES that grep-match a given string
# @param grepStr defaults to match everything
#
function es_delete_all() {
  local grepStr
  local indexList
  grepStr=$1
  if [[ -n "$grepStr" ]]; then
    indexList=$(es_indices 2> /dev/null | awk '{ print $3 }' | grep "$grepStr")
  else
    indexList=$(es_indices 2> /dev/null | awk '{ print $3 }')
  fi
  for name in $indexList; do
    echo curl -iv -X DELETE "${ESHOST}/$name"
    curl -iv -X DELETE "${ESHOST}/$name"
  done
}


#
# Setup `subject` index for arranger-projects-dev project
#
function es_setup_index() {
  local indexName
  indexName="${1:-gen3-dev-subject}"
  fileIndexName="${2:-gen3-dev-file}"
  configIndexName="${3:-gen3-dev-config}"
curl -iv -X PUT "${ESHOST}/${indexName}" \
-H 'Content-Type: application/json' -d'
{
    "settings" : {
      "index" : {
        "number_of_shards" : 1,
        "number_of_replicas" : 0,
        "analysis": {
          "tokenizer": {
            "ngram_tokenizer": {
              "type": "ngram",
              "min_gram": 2,
              "max_gram": 3,
              "token_chars": [ "letter", "digit" ]
            }
          },
          "analyzer": {
            "ngram_analyzer": {
              "type": "custom",
              "tokenizer": "ngram_tokenizer",
              "filter": [
                "lowercase"
              ]
            },
            "search_analyzer": {
              "type": "custom",
              "tokenizer": "keyword",
              "filter": "lowercase"
            }
          }
        }
      }
    },
    "mappings": {
      "properties": {
        "subject_id": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "name": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "project": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "study": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "visits": {
          "type": "nested",
          "properties": {
            "days_to_visit": { "type": "integer" },
            "visit_label": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
            "follow_ups": {
              "type": "nested",
              "properties": {
                "days_to_follow_up": { "type": "integer" },
                "follow_up_label": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } }
              }
            }
          }
        },
        "gender": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "race": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "ethnicity": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "vital_status": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "file_type": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "file_format": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "auth_resource_path": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
        "file_count": { "type": "integer" },
        "whatever_lab_result_value": { "type": "float" },
        "some_nested_array_field": {
          "type": "nested",
          "properties": {
            "some_integer_inside_nested": { "type": "integer" },
            "some_string_inside_nested": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } }
          }
        },
        "consortium_id": { "type": "integer" },
        "some_integer_field": { "type": "integer" },
        "some_long_field": { "type": "long" },
        "sensitive": { "type": "keyword" }
      }
    }
}
'

curl -iv -X PUT "${ESHOST}/${fileIndexName}" \
-H 'Content-Type: application/json' -d'
{
    "settings" : {
        "index" : {
            "number_of_shards" : 1,
            "number_of_replicas" : 0
        }
    },
    "mappings": {
      "properties": {
        "file_id": { "type": "keyword" },
        "auth_resource_path": { "type": "keyword" },
        "subject_id": { "type": "keyword" },
        "sensitive": { "type": "keyword" }
      }
    }
}
'

curl -iv -X PUT "${ESHOST}/${configIndexName}" \
-H 'Content-Type: application/json' -d'
{
    "settings" : {
        "index" : {
            "number_of_shards" : 1,
            "number_of_replicas" : 0
        }
    },
    "mappings": {
      "properties": {
        "array": { "type": "keyword" }
      }
    }
}
'

}


#
# Get the list of indexes
#
function es_indices() {
  curl -X GET "${ESHOST}/_cat/indices?v"
}
