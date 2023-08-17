#!/bin/bash

if [[ -z "$DD_TRACE_ENABLED" ]]; then
    export DD_TRACE_ENABLED=false
fi

# node --max-http-header-size 16000 --require dd-trace/init dist/server/server.js
node --max-old-space-size=3584 --max-http-header-size=16000 --require dd-trace/init dist/server/server.js
