#!/bin/bash

source ./commands.sh

CASE_INDEX_NAME=gen3-dev-subject
FILE_INDEX_NAME=gen3-dev-file
CONFIG_INDEX_NAME=gen3-dev-config
DATA_COUNT=100
es_delete_all $CASE_INDEX_NAME
es_delete_all $FILE_INDEX_NAME
es_delete_all $CONFIG_INDEX_NAME
es_setup_index $CASE_INDEX_NAME $FILE_INDEX_NAME $CONFIG_INDEX_NAME
es_gen_data 0 $DATA_COUNT $CASE_INDEX_NAME $FILE_INDEX_NAME $CONFIG_INDEX_NAME

echo "successfully generate ${DATA_COUNT} data records"
