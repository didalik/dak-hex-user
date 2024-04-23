#!/usr/bin/env bash

# Copyright (c) 2023-present, Дід Alik and the Kids {{{1
#
# This script is licensed under the Apache License, Version 2.0, found in the
# LICENSE file in the root directory of this source tree.
##

utest () { # {{{1
  echo "- utest $#: $@ PWD $PWD" >&2
  local p=$1 r=$2 d=$3 script2run=$4 port=$5; shift 5
  rm -f $p; mkfifo $p
  local q='.q.fifo'; rm -f $q; mkfifo $q
  local hp="$HTTP_SERVER_HOST:$port" ut="test/$1"
  { read <$q; ssh alec@m1 "open -u 'http://$hp/$ut'"; cat <$q; } &
  local s="{ . ./.profile; cd $d; $script2run $@; }"
  $SERVER_MJS $port $@ <$p 2>$q | ssh $r "$s" >$p
  EXIT_CODE=${PIPESTATUS[1]}
}

teardown () { # {{{1
  echo "- $0 exiting with EXIT_CODE $EXIT_CODE..." >&2
}
trap teardown EXIT

read -a ARGS # {{{1
echo "- $(dirname $0)/$(basename -s .sh $0).test-in ${#ARGS[@]}: ${ARGS[@]}"
. ../config.env # {{{1
[ $HOME = /Users/alec ] && . config.env || . config.u22.env
EXIT_CODE=111

utest \
  .p.fifo \
  "$REMOTE_ACCOUNT" \
  "$REMOTE_PWD" \
  './handle_agent_trade' \
  $PORT prod/fix/agent_trade ${ARGS[@]}
