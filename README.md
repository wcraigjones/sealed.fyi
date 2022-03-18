
# Sealed.fyi
Lets make a simple, but complete, go project to learn more about cryptography and serverless architecture!

## TODO:
* set cloudfront caching again
* make the code not super hacky

## Stack 
* Cloudfront for https
* Dynamo for kv and secrets
* S3 for encrypted data
* Lambda + API Gateway for API
* WAF for rate limiting

## URL Structure
sealed.fyi#aaaaaaaa.aaa.aaaaaaaaaa

- 8 are id (6 bytes)
- 4 meta (3 bytes)
- 8 are password (additional password may be required)

12 setting bits
0 burn on open
1 try to burn on prompt
2 burn on probe
3 password enabled
4 notify
5 file
6 burn without password
7 probe without password
8 - 11 reserved

## API

- / POST - Create (provides a key)
- / PUT - Save (stores data)
- /{id} GET - Read (delete if applicable)
- /{id} DELETE - delete
- /{id} HEAD - has this been read

File is gzipped then encrypted