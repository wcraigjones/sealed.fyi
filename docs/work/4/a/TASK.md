# Phase 4, Stream A: CloudFront Distribution

## Goal
Create CloudFront distribution for frontend delivery.

## Files
- `infrastructure/cloudfront.yaml`

## CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: CloudFront distribution for sealed.fyi

Parameters:
  DomainName:
    Type: String
    Default: sealed.fyi
  CertificateArn:
    Type: String
    Description: ACM certificate ARN for HTTPS
  S3BucketName:
    Type: String
    Description: S3 bucket for static files

Resources:
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        DefaultRootObject: index.html
        Aliases:
          - !Ref DomainName
        Origins:
          - Id: S3Origin
            DomainName: !Sub ${S3BucketName}.s3.amazonaws.com
            S3OriginConfig:
              OriginAccessIdentity: !Sub origin-access-identity/cloudfront/${CloudFrontOAI}
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: !Ref CachePolicy
          FunctionAssociations:
            - EventType: viewer-response
              FunctionARN: !GetAtt SecurityHeadersFunction.FunctionARN
        CustomErrorResponses:
          - ErrorCode: 404
            ResponseCode: 200
            ResponsePagePath: /index.html
          - ErrorCode: 403
            ResponseCode: 200
            ResponsePagePath: /index.html
        ViewerCertificate:
          AcmCertificateArn: !Ref CertificateArn
          SslSupportMethod: sni-only
          MinimumProtocolVersion: TLSv1.2_2021
```

## Cache Behaviors
- HTML: no-store (always fresh)
- JS/CSS: cache with versioned filenames
- API: passthrough to API Gateway

## Custom Error Pages
- 404 → index.html (SPA routing)
- 403 → index.html (SPA routing)

## Security
- HTTPS only (redirect HTTP)
- TLS 1.2 minimum
- Security headers via CloudFront Function

## Exit Criteria
- [ ] CloudFormation template valid
- [ ] Distribution deploys successfully
- [ ] HTTPS works
- [ ] Custom domain works
- [ ] SPA routing works (deep links)
- [ ] Code reviewed
