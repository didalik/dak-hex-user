# Copyright (c) 2023-present, Дід Alik and the Kids {{{1
#
# This script is licensed under the Apache License, Version 2.0, found in the
# LICENSE file in the root directory of this source tree.
##

SHELL := /bin/bash
all-tests := $(addsuffix .test, $(basename $(wildcard *.test-in)))
.PHONY : test all %.test

test : $(all-tests)

%.test : %.test-in %.test-cmp %.sh
	@rm -f test.failed; ./$(word 3, $?) <$< 2>&1 | tee last.out | \
		diff -q $(word 2, $?) - >/dev/null && mv last.out $(word 2, $?) || \
		echo "Test $@ failed" | tee test.failed

all : test 
	@[ -e test.failed ] || echo "Success, all tests passed."

# Tons of thanks to: {{{1
# - https://stackoverflow.com/questions/4927676/implementing-make-check-or-make-test
