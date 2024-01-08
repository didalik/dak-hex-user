#!/usr/bin/env bash

# Copyright (c) 2023-present, Дід Alik and the Kids {{{1
#
# This script is licensed under the Apache License, Version 2.0, found in the
# LICENSE file in the root directory of this source tree.
##

loop_user_requests () { # {{{1
  echo "- loop_user_requests $#: $@ PWD $PWD" >&2

  local p=$1 r=$2 d=$3 script2run=$4 port=$5; shift 4
  { sleep 1; ssh alec@m1 "open -u 'http://u22:$port'"; } &
  local s="{ . ./.profile; cd $d; $script2run; }"
  rm -f $p; mkfifo $p
  $SERVER_MJS $@ < $p | ssh $r "$s" > $p
}

teardown () { # {{{1
  echo "- $0 exiting..." >&2
}
trap teardown EXIT

. ../config.env # {{{1
. config.env

rm -f loop.log error.log; touch loop.log
loop_user_requests \
  .qa.fifo \
  "$REMOTE_ACCOUNT" \
  "$DAK_HOME/hex/user/qa" \
  './handle_request.sh' \
  $PORT
