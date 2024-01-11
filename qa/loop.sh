#!/usr/bin/env bash

# Copyright (c) 2023-present, Дід Alik and the Kids {{{1
#
# This script is licensed under the Apache License, Version 2.0, found in the
# LICENSE file in the root directory of this source tree.
##

loop_user_requests () { # {{{1
  echo "- loop_user_requests $#: $@ PWD $PWD" >&2

  local p=$1 r=$2 d=$3 script2run=$4 port=$5; shift 4
  { sleep 1; ssh alec@m1 "open -u 'http://$HTTP_SERVER_HOST:$port'"; } &
  local s="{ . ./.profile; cd $d; $script2run; }"
  rm -f $p; mkfifo $p
  $SERVER_MJS $@ < $p | ssh $r "$s" > $p
  EXIT_CODE=${PIPESTATUS[1]}
}

teardown () { # {{{1
  echo "- $0 exiting with EXIT_CODE $EXIT_CODE..." >&2
  [ $EXIT_CODE -eq 0 ] && exit $EXIT_CODE
}
trap teardown EXIT

. ../config.env # {{{1
. config.env

loop_user_requests \
  .qa.fifo \
  "$REMOTE_ACCOUNT" \
  "$REMOTE_PWD" \
  './handle_request.sh' \
  $PORT
