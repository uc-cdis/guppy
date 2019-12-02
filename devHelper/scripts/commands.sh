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
              "max_gram": 20,
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
      "subject": {
        "properties": {
          "subject_id": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "name": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "project": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "study": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "gender": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "race": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "ethnicity": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "vital_status": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "file_type": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "file_format": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "gen3_resource_path": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "file_count": { "type": "integer" },
          "whatever_lab_result_value": { "type": "float" },
          "some_string_field": { "type": "keyword", "fields": { "analyzed": {"type": "text", "analyzer": "ngram_analyzer", "search_analyzer": "search_analyzer", "term_vector": "with_positions_offsets"} } },
          "some_integer_field": { "type": "integer" },
          "some_long_field": { "type": "long" }
        }
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
      "file": {
        "properties": {
          "file_id": { "type": "keyword" },
          "gen3_resource_path": { "type": "keyword" },
          "subject_id": { "type": "keyword" }
        }
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

#
# Generate test data in index
#
function es_gen_data() {
  local startIndex
  local endIndex
  local COUNT
  local tmpName
  local indexName
  startIndex="${1:-0}"
  endIndex="${2:-0}"
  indexName="${3:-gen3-dev-subject}"
  fileIndexName="${4:-gen3-dev-file}"
  configIndexName="${5:-gen3-dev-config}"

declare -a genderList
declare -a ethnicityList
declare -a raceList
declare -a vitalList
declare -a fileTypeList
declare -a fileFormat

genderList=( "male" "female" "unknown")
ethnicityList=( "American Indian" "Pacific Islander" "Black" "Multi-racial" "White" "Haspanic" "__missing__" )
raceList=( "white" "black" "hispanic" "asian" "mixed" "not reported" )
vitalList=( "Alive" "Dead" "no data" )
fileTypeList=( "mRNA Array" "Unaligned Reads" "Lipdomic MS" "Protionic MS" "1Gs Ribosomes" "Unknown" )
fileFormatList=( "BEM" "BAM" "BED" "CSV" "FASTQ" "RAW" "TAR" "TSV" "TXT" "IDAT" "__missing__" )
resourceList=( "/programs/jnkns/projects/jenkins" "/programs/DEV/projects/test" "/programs/external/projects/test")
projectList=( "jnkns-jenkins" "DEV-test" "external-test" )

COUNT=$startIndex
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp}"
tmpName="$(mktemp $XDG_RUNTIME_DIR/es.json.XXXXXX)"
while [[ $COUNT -lt $endIndex ]]; do
  projectIndex=$(( $RANDOM % ${#projectList[@]} ))
  projectName="${projectList[$projectIndex]}"
  resourceName="${resourceList[$projectIndex]}"
  studyIndex=$(( $RANDOM % 10 ))
  gender="${genderList[$(( $RANDOM % ${#genderList[@]} ))]}"
  ethnicity="${ethnicityList[$(( $RANDOM % ${#ethnicityList[@]} ))]}"
  race="${raceList[$(( $RANDOM % ${#raceList[@]} ))]}"
  vital="${vitalList[$(( $RANDOM % ${#vitalList[@]} ))]}"
  fileType="${fileTypeList[$(( $RANDOM % ${#fileTypeList[@]} ))]}"
  fileFormat="${fileFormatList[$(( $RANDOM % ${#fileFormatList[@]} ))]}"
  fileCounts=$(( $RANDOM % 100 ))
  randomFloatNumber="$(( $RANDOM % 100 )).$(( $RANDOM % 100 ))"
  stringArray='["1", "2"]'
  intArray='[1, 2]'
  longNumber="10737418240"

  cat - > "$tmpName" <<EOM
{
  "subject_id": "$COUNT",
  "name": "Subject-$COUNT",
  "project": "${projectName}",
  "study": "${projectName}-Study-${studyIndex}",
  "gender": "${gender}",
  "ethnicity": "${ethnicity}",
  "race": "${race}",
  "vital_status": "${vital}",
  "file_type": "${fileType}",
  "file_format": "${fileFormat}",
  "gen3_resource_path": "${resourceName}",
  "file_count": $fileCounts,
  "whatever_lab_result_value": $randomFloatNumber,
  "some_string_field": $stringArray,
  "some_integer_field": $intArray,
  "some_long_field": $longNumber
}
EOM
  cat - $tmpName <<EOM
Loading record:
EOM
  curl -X PUT "${ESHOST}/${indexName}/subject/${COUNT}?pretty" \
       -H 'Content-Type: application/json' "-d@$tmpName"


  cat - > "$tmpName" <<EOM
{
  "subject_id": "$COUNT",
  "gen3_resource_path": "${resourceName}",
  "file_id": "file_id_$(( $RANDOM % 1000 ))"
}
EOM
  cat - $tmpName <<EOM
Loading record:
EOM
  curl -X PUT "${ESHOST}/${fileIndexName}/file/${COUNT}?pretty" \
       -H 'Content-Type: application/json' "-d@$tmpName"
  let COUNT+=1
done

curl -X PUT "${ESHOST}/${configIndexName}/_doc/gen3-dev-subject?pretty" \
  -H 'Content-Type: application/json' -d '
  {
    "array": [
      "some_string_field",
      "some_integer_field"
    ]
  }
  '
}
