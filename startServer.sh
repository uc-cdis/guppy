#!/bin/bash

node --max-http-header-size 16000 --require dist/server/server.js
