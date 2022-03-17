package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
)

var (
	dynamoTableName = "private_keys"

	jsonHeaders = map[string]string{
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Origin":  "https://sealed.fyi",
		"Access-Control-Allow-Methods": "OPTIONS,POST,GET,HEAD,DELETE",
		"Content-Type":                 "application/json",
	}

	txtHeaders = map[string]string{
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Origin":  "https://sealed.fyi",
		"Access-Control-Allow-Methods": "OPTIONS,POST,GET,HEAD,DELETE",
		"Content-Type":                 "plain/txt",
	}

	dynamoSVC *dynamodb.DynamoDB
)

type DynamoRow struct {
	ID         string  `json:"id"`
	Salt       string  `json:"salt"`
	PrivateKey *string `json:"privateKey"`
	Created    string  `json:"created_at"`
	Saved      *string `json:"saved_at,omitempty"`
}

func init() {
	mySession := session.Must(session.NewSession())
	dynamoSVC = dynamodb.New(mySession)
}

func main() {
	lambda.Start(handleRequest)
}

func errorResp(status int, message string) events.APIGatewayProxyResponse {
	return events.APIGatewayProxyResponse{
		Headers:    txtHeaders,
		StatusCode: status,
		Body:       message,
	}
}

func jsonResp(status int, message interface{}) events.APIGatewayProxyResponse {
	data, err := json.Marshal(message)
	if err != nil {
		return errorResp(400, fmt.Sprintf("could not marshal json: %v", err))
	}
	return events.APIGatewayProxyResponse{
		Headers:    jsonHeaders,
		StatusCode: status,
		Body:       string(data),
	}
}

func handleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	method := request.HTTPMethod

	switch method {
	case http.MethodGet:
		return readHandler(ctx, request)
	case http.MethodPost:
		return createHandler(ctx, request)
	case http.MethodPut:
		return saveHandler(ctx, request)
	case http.MethodDelete:
		return deleteHandler(ctx, request)
	case http.MethodHead:
		return peekHandler(ctx, request)
	}

	return errorResp(404, "not found"), nil
}

func readHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return errorResp(501, "not implemented"), nil
}

func createHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	type createResp struct {
		ID       string `json:"id"`
		Password string `json:"password"`
		Key      string `json:"key"`
		Salt     string `json:"salt"`
		Private  string `json:"private"`
	}

	id := make([]byte, 8)
	rand.Read(id)

	resp := createResp{
		ID: base64.RawURLEncoding.EncodeToString(id),
	}

	password, salt, publicKeyBytes, privateKeyBytes, err := generateKey()
	if err != nil {
		return errorResp(500, fmt.Sprintf("could not generate key: %v", err)), nil
	}

	resp.Password = base64.RawURLEncoding.EncodeToString(password)
	resp.Key = base64.RawURLEncoding.EncodeToString(publicKeyBytes)

	// Remove these
	resp.Salt = base64.RawURLEncoding.EncodeToString(salt)
	resp.Private = base64.RawURLEncoding.EncodeToString(privateKeyBytes)

	drow := DynamoRow{
		ID:         resp.ID,
		Salt:       resp.Salt,
		PrivateKey: &resp.Private,
		Created:    time.Now().UTC().Format(time.RFC3339),
	}

	drowAV, err := dynamodbattribute.MarshalMap(drow)
	if err != nil {
		return errorResp(500, fmt.Sprintf("could not marshal dynamo row: %v", err)), nil
	}

	_, err = dynamoSVC.PutItem(&dynamodb.PutItemInput{
		Item:      drowAV,
		TableName: &dynamoTableName,
	})
	if err != nil {
		return errorResp(500, fmt.Sprintf("could put dynamo object: %v", err)), nil
	}

	return jsonResp(200, resp), nil
}

func generateKey() (password, salt, publicKeyBytes, privateKeyBytes []byte, err error) {
	password = make([]byte, 12)
	rand.Read(password)

	salt = make([]byte, 12)
	rand.Read(salt)

	privatekey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, nil, nil, nil, errors.Wrap(err, "could not generate key")
	}

	privateKeyBytes = x509.MarshalPKCS1PrivateKey(privatekey)
	privateKeyBlock := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privateKeyBytes,
	}
	privateKeyBytes = pem.EncodeToMemory(privateKeyBlock)

	publicKeyBytes = x509.MarshalPKCS1PublicKey(&privatekey.PublicKey)
	publicKeyBlock := &pem.Block{
		Type:  "RSA PUBLIC KEY",
		Bytes: publicKeyBytes,
	}
	publicKeyBytes = pem.EncodeToMemory(publicKeyBlock)

	// generate hash
	hash, err := bcrypt.GenerateFromPassword(password, 10)
	if err != nil {
		return nil, nil, nil, nil, errors.Wrap(err, "could not generate hash")
	}

	cipherPassword := hash[28:]

	block, err := aes.NewCipher(cipherPassword)
	if err != nil {
		return nil, nil, nil, nil, errors.Wrap(err, "could not instantiate cipher")
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, nil, nil, errors.Wrap(err, "could not instantiate cipher block")
	}

	privateKeyBytes = aesgcm.Seal(nil, salt, privateKeyBytes, nil)

	return password, salt, publicKeyBytes, privateKeyBytes, nil
}

func saveHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return errorResp(501, "not implemented"), nil
}

func deleteHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return errorResp(501, "not implemented"), nil
}

func peekHandler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return errorResp(501, "not implemented"), nil
}
