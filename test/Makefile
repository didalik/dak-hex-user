# Tons of thanks to:
# - https://stackoverflow.com/questions/4927676/implementing-make-check-or-make-test

SHELL := /bin/bash
all-tests := $(addsuffix .test, $(basename $(wildcard *.test-in)))
.PHONY : clean test all %.test

test : $(all-tests)

%.test : %.test-in %.test-cmp %.sh
	@./$(word 3, $?) <$< 2>&1 | tee -a all.out | \
		diff -q $(word 2, $?) - >/dev/null || (echo "Test $@ failed" && exit 1)

all : test 
	@echo "Success, all tests passed."

clean :
	@rm -f all.out

