package main

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

type resp struct {
	Method string `json:"method"`
	Path   string `json:"path"`
	Key    string `json:"key"`
}

func handleRequest(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	resp := resp{
		Method: request.HTTPMethod,
		Path:   request.Path,
	}

	privatekey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return events.APIGatewayProxyResponse{
			Headers: map[string]string{
				"Access-Control-Allow-Headers": "Content-Type",
				"Access-Control-Allow-Origin":  "https://sealed.fyi",
				"Access-Control-Allow-Methods": "OPTIONS,POST,GET",
				"Content-Type":                 "application/json",
			},
			Body:       "generate: " + err.Error(),
			StatusCode: 200,
		}, nil
	}

	// dump public key to file
	publicKeyBytes, err := x509.MarshalPKIXPublicKey(&privatekey.PublicKey)
	if err != nil {
		return events.APIGatewayProxyResponse{
			Headers: map[string]string{
				"Access-Control-Allow-Headers": "Content-Type",
				"Access-Control-Allow-Origin":  "https://sealed.fyi",
				"Access-Control-Allow-Methods": "OPTIONS,POST,GET",
				"Content-Type":                 "application/json",
			},
			Body:       "pubkey: " + err.Error(),
			StatusCode: 200,
		}, nil
	}
	publicKeyBlock := &pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: publicKeyBytes,
	}
	data := pem.EncodeToMemory(publicKeyBlock)
	resp.Key = string(data)
	// resp.Key = base64.StdEncoding.EncodeToString(x509.MarshalPKCS1PublicKey(&privatekey.PublicKey))

	data, err = json.Marshal(resp)
	if err != nil {
		return events.APIGatewayProxyResponse{
			Headers: map[string]string{
				"Access-Control-Allow-Headers": "Content-Type",
				"Access-Control-Allow-Origin":  "https://sealed.fyi",
				"Access-Control-Allow-Methods": "OPTIONS,POST,GET",
				"Content-Type":                 "application/json",
			},
			Body:       "marshal: " + err.Error(),
			StatusCode: 200,
		}, nil
	}

	return events.APIGatewayProxyResponse{
		Headers: map[string]string{
			"Access-Control-Allow-Headers": "Content-Type",
			"Access-Control-Allow-Origin":  "https://sealed.fyi",
			"Access-Control-Allow-Methods": "OPTIONS,POST,GET",
			"Content-Type":                 "application/json",
		},
		Body:       string(data),
		StatusCode: 200,
	}, nil
}

func main() {
	lambda.Start(handleRequest)
}
