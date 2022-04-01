VERSION := $(shell date "+%Y.%m.%d-%H.%M")
EXPECTED_ACCOUNT := "909391724831"
ACCOUNT := "$(shell aws sts get-caller-identity | jq -r ".Account")"

.PHONY: test-account
test-account:
	@echo "Expected account: $(EXPECTED_ACCOUNT)"
	@echo "  Loaded account: $(ACCOUNT)"
ifeq "$(ACCOUNT)" "$(EXPECTED_ACCOUNT)"
	@echo "Accounts match"
else
	@echo "Accounts do not match."
	@echo ""
	@echo 'eval $$(make set-profile)'
	@echo ""
	@exit 1
endif

.PHONY: set-profile
set-profile:
	@echo export AWS_PROFILE=sealed.fyi


.PHONY: publish-api
publish-api:
	@echo "Releasing version $(VERSION)"
	GOOS=linux go build ./api/main.go
	zip function.zip main
	aws s3 cp ./function.zip s3://code.sealed.fyi/function-$(VERSION).zip
	rm main function.zip
	aws lambda update-function-code --function api-sealed-fyi --s3-bucket code.sealed.fyi --s3-key function-$(VERSION).zip --publish

.PHONY: publish-www
publish-www:
	aws s3 sync --delete ./www/ s3://sealed.fyi/