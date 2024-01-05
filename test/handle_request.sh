#!/usr/bin/env bash

teardown () { # {{{1
  kill $PID_OF_TAIL
}

trap teardown EXIT

. ../config.env # {{{1

tail -n 999999 -f loop.log &
PID_OF_TAIL=$!
$RUN_MJS handle_request >> loop.log 2>error.log
