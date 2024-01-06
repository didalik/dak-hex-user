#!/usr/bin/env bash

teardown () { # {{{1
  kill $PID_OF_TAIL
}
trap teardown EXIT

. ../config.env # {{{1

tail -n 999999 -f loop.log &
PID_OF_TAIL=$!

# render HTML head {{{1
cat << HTML
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>THIS IS A TEST</title>
  </head>
  <body>
    <samp><p>- starting the test...<br/>
HTML

$RUN_MJS handle_request >> loop.log 2>error.log # {{{1

# render HTML tail {{{1
cat << HTML
</p></samp></body></html>
HTML
