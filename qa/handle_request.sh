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
    0) end_phase0 $@; echo "$htmlTail"
      [ $(cat loop.log | grep 'PHASE COMPLETE' | wc -l) -eq 1 ] && phase=$EXIT_CODE;;
    1) end_phase1 $@; echo "$htmlTail"
      [ $(cat loop.log | grep 'PHASE COMPLETE' | wc -l) -eq 1 ] && phase=$EXIT_CODE;;
    *) echo "- HUH? phase ${phase}<br/>$htmlTail"
      phase=0
  esac
  exit $phase
}

end_phase0 () { # {{{1
  local keys_agent=$(cat $KEYS_AGENT)
  export SIGNER_SK=${keys_agent% *}
  export SIGNER_PK=${keys_agent##* }
  local keys_user=$(cat ../build/keys)
  export USER_PK=${keys_user##* }
  local kind='remote'
  [ $LOCAL_DEV_REQUESTED ] && kind='local'
  
  log "&nbsp;- $0 end_phase0 $#: $@ PWD $PWD"
  log "&nbsp;- the $kind hex svc AGENT is authorizing you as a $kind hex svc USER"
  log "&nbsp;- agentPK $SIGNER_PK"
  log "&nbsp;- userPK $USER_PK"
  log "&nbsp;- svcPK $SVC_PK"
  echo '<pre>'
  PORT_SVC=8788 $RUN_MJS svc $kind newuser 2>&1 #2>>$LOCALDEV_LOG
  EXIT_CODE=$?
  echo '</pre>'
  log "&nbsp;- EXIT_CODE $EXIT_CODE"
}

end_phase1 () { # {{{1
  log "&nbsp;- $0 end_phase1 $#: $@ PWD $PWD"
  log "&nbsp;- the HEX_CREATOR account on Stellar testnet:"
  read SK PK < ../build/testnet.keys
  echo '<pre>'
  HEX_CREATOR_PK=$PK PORT_SVC=8788 $RUN_MJS end_phase1 2>&1 #2>>$LOCALDEV_LOG
  EXIT_CODE=$?
  echo '</pre>'
  log "&nbsp;- EXIT_CODE $EXIT_CODE"
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
end_phase $EXIT_CODE >> loop.log 2>>$LOCALDEV_LOG

# With thanks to: {{{1
# - https://stackoverflow.com/questions/1521462/looping-through-the-content-of-a-file-in-bash
#
##
