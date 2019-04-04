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
curl -iv -X PUT "${ESHOST}/${indexName}" \
-H 'Content-Type: application/json' -d'
{
    "settings" : {
        "index" : {
            "number_of_shards" : 1,
            "number_of_replicas" : 0
        }
    },
    "mappings": {
      "subject": {
        "properties": {
          "subject_id": { "type": "keyword" },
          "name": { "type": "text" },
          "project": { "type": "keyword" },
          "study": { "type": "keyword" },
          "gender": { "type": "keyword" },
          "race": { "type": "keyword" },
          "ethnicity": { "type": "keyword" },
          "vital_status": { "type": "keyword" },
          "file_type": { "type": "keyword" },
          "file_format": { "type": "keyword" },
          "gen3_resource_path": { "type": "keyword" },
          "file_count": { "type": "integer" },
          "whatever_lab_result_value": { "type": "float" }
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

declare -a genderList
declare -a ethnicityList
declare -a raceList
declare -a vitalList
declare -a fileTypeList
declare -a fileFormat

genderList=( male female )
ethnicityList=( 'American Indian' 'Pacific Islander' 'Black' 'Multi-racial' 'White' 'Haspanic' )
raceList=( white black hispanic asian mixed )
vitalList=( Alive Dead )
fileTypeList=( "mRNA Array" "Unaligned Reads" "Lipdomic MS" "Protionic MS" "1Gs Ribosomes")
fileFormatList=( BEM BAM BED CSV FASTQ RAW TAR TSV TXT IDAT )
resourceList=( "/programs/jnkns/projects/jenkins" "/programs/DEV/projects/test")
projectList=( "jenkins" "test" )


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
  "whatever_lab_result_value": $randomFloatNumber
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
}
