#!/bin/bash

source ./commands.sh

INDEX_NAME=gen3-dev-subject
DATA_COUNT=100
es_delete_all $INDEX_NAME
es_setup_index $INDEX_NAME

es_gen_data 0 $DATA_COUNT $INDEX_NAME
echo "successfully generate ${DATA_COUNT} data records into ${ESHOST}/${INDEX_NAME}"