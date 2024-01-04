#!/usr/bin/env bash

loop_user_requests () { # {{{1
  echo "- loop_user_requests $#: $@ PWD $PWD" >&2

  local p=$1 r=$2 d=$3 script2run=$4 port=$5; shift 4
  { sleep 1; ssh alec@m1 "open -u 'http://u22:$port/dynamic'"; } &
  local s="{ cd $d; $script2run; }"
  rm -f $p; mkfifo $p
  cat < $p | $RUN_MJS $@ | ssh $r "$s" > $p
}

. ../config.env # {{{1

loop_user_requests \
  .test.fifo \
  'alik@localhost' \
  './people/didalik/dak/hex/user/test' \
  './handle_request.sh' \
  8000
