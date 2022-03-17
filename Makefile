VERSION := $(shell date "+%Y.%m.%d-%H.%M")

.PHONY: publish-api
publish-api:
	echo "Releasing version $(VERSION)"
	GOOS=linux go build ./api/main.go
	zip function.zip main
	aws s3 cp ./function.zip s3://code.sealed.fyi/function-$(VERSION).zip
	rm main function.zip
	aws lambda update-function-code --function api-sealed-fyi --s3-bucket code.sealed.fyi --s3-key function-$(VERSION).zip --publish

.PHONY: publish-www
publish-www:
	aws s3 sync --delete ./www/ s3://sealed.fyi/