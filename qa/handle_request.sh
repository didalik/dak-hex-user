#!/usr/bin/env bash

# Copyright (c) 2023-present, Дід Alik and the Kids {{{1
#
# This script is licensed under the Apache License, Version 2.0, found in the
# LICENSE file in the root directory of this source tree.
##

LOCALDEV_LOG=error.log # {{{1

teardown () { # {{{1
  while read;do kill $REPLY;done <.pids2kill
  kill $PID_OF_TAIL
  echo "- teardown killed dev pids and PID_OF_TAIL $PID_OF_TAIL" >> $LOCALDEV_LOG
}
trap teardown EXIT

rm -f .pids2kill loop.log $LOCALDEV_LOG # {{{1 
touch loop.log
tail -n 999999 -f loop.log &
PID_OF_TAIL=$!

. ../config.env
. config.env
. ../dak/util/public/lib/util.sh
[ $LOCAL_DEV_REQUESTED ] && start_local_dev index 2 && start_local_dev hex 3

$RUN_MJS handle_request >> loop.log 2>>$LOCALDEV_LOG # {{{1
