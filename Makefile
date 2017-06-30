.PHONY: clean test release

BIN=./node_modules/.bin

clean:

dist: 
	
test:
	
release: clean dist test
ifeq ($(strip $(version)),)
	@echo "\033[31mERROR:\033[0;39m No version provided"
	@echo "\033[1;30mmake release version=1.0.0\033[0;39m"
else
	npm version $(version)
	npm publish
	git push origin master
	git push origin --tags
endif
