#!/usr/bin/env bash

loop_user_requests () { # {{{1
  echo "- loop_user_requests $#: $@ PWD $PWD" >&2

  local p=$1 r=$2 d=$3 script2run=$4 port=$5; shift 4
  { sleep 1; ssh alec@m1 "open -u 'http://u22:$port/dynamic/'"; } &
  local s="{ . ./.profile; cd $d; $script2run; }"
  rm -f $p; mkfifo $p
  $SERVER_MJS $@ < $p | ssh $r "$s" > $p
}

. ../config.env # {{{1

rm -f loop.log error.log; touch loop.log
loop_user_requests \
  .test.fifo \
  'alik@localhost' \
  "$DAK_HOME/hex/user/test" \
  './handle_request.sh' \
  8000
