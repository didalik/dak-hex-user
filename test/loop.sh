#!/usr/bin/env bash

# Copyright (c) 2023-present, Дід Alik and the Kids {{{1
#
# This script is licensed under the Apache License, Version 2.0, found in the
# LICENSE file in the root directory of this source tree.
##

loop_user_requests () { # {{{1
  echo "- loop_user_requests $#: $@ PWD $PWD" >&2

  local p=$1 r=$2 d=$3 script2run=$4 port=$5; shift 4
  { sleep 1; ssh alec@m1 "open -u 'http://u22:$port/dynamic/$2'"; } &
  local s="{ . ./.profile; cd $d; $script2run; }"
  rm -f $p; mkfifo $p
  $SERVER_MJS $@ < $p | ssh $r "$s" > $p
}

loop_requests () { # {{{1
  echo "- loop_requests $#: $@ PWD $PWD" >&2

  local p=$1 r=$2 d=$3 script2run=$4 port=$5; shift 4
  rm -f $p; mkfifo $p
  local q='.q.fifo'; rm -f $q; mkfifo $q
  { read <$q; ssh alec@m1 "open -u 'http://u22:$port/dynamic/$2'"; cat <$q; } &
  #{ read <$q;echo "$REPLY - SERVER_MJS bound"; } &
  local s="{ . ./.profile; cd $d; $script2run; }"
  $SERVER_MJS $@ <$p 2>$q | ssh $r "$s" >$p
}

. ../config.env # {{{1

rm -f loop.log error.log; touch loop.log
loop_requests \
  .test.fifo \
  'alik@localhost' \
  "$DAK_HOME/hex/user/test" \
  './handle_request.sh' \
  8000 test1
