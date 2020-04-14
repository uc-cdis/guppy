#!/bin/bash

source ./devHelper/scripts/commands.sh

SUBJECT_INDEX_NAME=gen3-dev-subject
FILE_INDEX_NAME=gen3-dev-file
CONFIG_INDEX_NAME=gen3-dev-config
DATA_COUNT=100
es_delete_all $SUBJECT_INDEX_NAME
es_delete_all $FILE_INDEX_NAME
es_delete_all $CONFIG_INDEX_NAME
es_setup_index $SUBJECT_INDEX_NAME $FILE_INDEX_NAME $CONFIG_INDEX_NAME
npm run gendata -- -i $SUBJECT_INDEX_NAME -d subject -n $DATA_COUNT
npm run gendata -- -i $FILE_INDEX_NAME -d file -n $DATA_COUNT
npm run gendata -- -i $CONFIG_INDEX_NAME -d config -n $DATA_COUNT

echo "Successfully generate ${DATA_COUNT} data records"
