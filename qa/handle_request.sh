#!/usr/bin/env bash

# Copyright (c) 2023-present, Дід Alik and the Kids {{{1
#
# This script is licensed under the Apache License, Version 2.0, found in the
# LICENSE file in the root directory of this source tree.
##

start_local_dev () { # {{{1
  local svc_name=$1
  local svc_count=$2
  local svc_dir=../../../svc/${svc_name}
  local dev_fifo=${svc_dir}/dev.fifo
  local dev_script=${svc_dir}/${svc_name}-dev.sh
  local grep_pattern='wrangler-dist/cli.js dev'

  echo "- $0 checking local svc ${svc_name}..." >> error.log
  if [ $(ps -ef|grep "${svc_name}-dev.sh"|wc -l) -eq 1 ]; then
    echo "- $0 starting local svc ${svc_name}..." >> error.log
    $dev_script >> error.log &
    echo $svc_name > $dev_fifo
    while [ $(ps -ef|grep "$grep_pattern"|wc -l) -lt $svc_count ]; do
      echo -e "\t- $dev_script starting wrangler dev..." >> error.log
      sleep 1
    done
    sleep 1
  fi
  echo "- $0 local svc ${svc_name} is ON." >> error.log
}

teardown () { # {{{1
  kill $PID_OF_TAIL
  echo "- teardown killed PID_OF_TAIL $PID_OF_TAIL" >> error.log
}
trap teardown EXIT

rm -f loop.log error.log # {{{1 
touch loop.log
tail -n 999999 -f loop.log &
PID_OF_TAIL=$!

. ../config.env
. config.env
[ $LOCAL_DEV_REQUESTED ] && start_local_dev index 2 && start_local_dev hex 3

$RUN_MJS handle_request >> loop.log 2>>error.log # {{{1
