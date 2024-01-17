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

end_phase () { # {{{1
  local phase=$1; shift
  local htmlTail="- stopping QA phase $phase on $(date)...<br/>"
  htmlTail="${htmlTail}</p></samp></body></html>"
  case $phase in
    0) end_phase0 $@ >> loop.log; echo "$htmlTail" >> loop.log;;
    *) echo "- HUH? phase ${phase}<br/>$htmlTail" >> loop.log
      phase=0
  esac
  exit $phase
}

end_phase0 () { # {{{1
  local kind='remote'
  local keys_agent=$(cat $KEYS_AGENT)
  local agentSK=${keys_agent% *}
  local agentPK=${keys_agent##* }
  local keys_user=$(cat ../build/keys)
  local userPK=${keys_user##* }
  [ $LOCAL_DEV_REQUESTED ] && kind='local'
  log "&nbsp;- $0 end_phase0 $#: $@ PWD $PWD"
  log "&nbsp;- the $kind hex svc AGENT is authorizing you as a $kind hex svc USER"
  log "&nbsp;- agentPK $agentPK"
  log "&nbsp;- userPK $userPK"
}

log () { # {{{1
  echo "${1}<br/>"
}

rm -f .pids2kill loop.log $LOCALDEV_LOG # {{{1 
touch loop.log
tail -n 999999 -f loop.log &
PID_OF_TAIL=$!

. ../config.env
. config.env
. ../dak/util/public/lib/util.sh
[ $LOCAL_DEV_REQUESTED ] && start_local_dev index 2 && start_local_dev hex 3

$RUN_MJS handle_request >> loop.log 2>>$LOCALDEV_LOG # {{{1
EXIT_CODE=$?
end_phase $EXIT_CODE

# With thanks to: {{{1
# - https://stackoverflow.com/questions/1521462/looping-through-the-content-of-a-file-in-bash
#
##
