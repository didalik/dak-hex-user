#!/usr/bin/env bash

# Copyright (c) 2023-present, Дід Alik and the Kids {{{1
#
# This script is licensed under the Apache License, Version 2.0, found in the
# LICENSE file in the root directory of this source tree.
##

teardown () { # {{{1
  kill $PID_OF_TAIL
}
trap teardown EXIT

. ../config.env # {{{1

tail -n 999999 -f loop.log &
PID_OF_TAIL=$!

$RUN_MJS handle_request >> loop.log 2>error.log # {{{1
