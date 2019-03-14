#!/bin/bash

export ESHOST=${ESHOST:-"localhost:9200"}

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
          "file_count": { "type": "integer" }
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

COUNT=$startIndex
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp}"
tmpName="$(mktemp $XDG_RUNTIME_DIR/es.json.XXXXXX)"
while [[ $COUNT -lt $endIndex ]]; do
  projectIndex=$(( $RANDOM % 5 ))
  projectName="Proj-${projectIndex}"
  if [[ $projectIndex == 0 ]]; then
    # dev environments have a test project
    projectName="test"
  fi
  studyIndex=$(( $RANDOM % 10 ))
  gender="${genderList[$(( $RANDOM % ${#genderList[@]} + 1))]}"
  ethnicity="${ethnicityList[$(( $RANDOM % ${#ethnicityList[@]} + 1))]}"
  race="${raceList[$(( $RANDOM % ${#raceList[@]} + 1))]}"
  vital="${vitalList[$(( $RANDOM % ${#vitalList[@]} + 1))]}"
  fileType="${fileTypeList[$(( $RANDOM % ${#fileTypeList[@]} + 1))]}"
  fileFormat="${fileFormatList[$(( $RANDOM % ${#fileFormatList[@]} + 1))]}"
  fileCounts=$(( $RANDOM % 100 ))

  cat - > "$tmpName" <<EOM
{
  "name": "Subject-$COUNT",
  "project": "${projectName}",
  "study": "Study-${projectIndex}${studyIndex}",
  "gender": "${gender}",
  "ethnicity": "${ethnicity}",
  "race": "${race}",
  "vital_status": "${vital}",
  "file_type": "${fileType}",
  "file_format": "${fileFormat}",
  "gen3_resource_path": "/projects/$projectName",
  "file_count": $fileCounts
}
EOM
  cat - $tmpName <<EOM
Loading record:
EOM
  curl -X PUT "${ESHOST}/${indexName}/subject/${COUNT}?pretty" \
       -H 'Content-Type: application/json' "-d@$tmpName"

  let COUNT+=1
done
}