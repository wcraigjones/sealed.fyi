# Phase 4, Stream B: S3 & Domain Setup

## Goal
Set up S3 bucket for static hosting and configure domain.

## Files
- `infrastructure/s3.yaml`
- `infrastructure/route53.yaml` (or DNS instructions)

## S3 Bucket Configuration

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: S3 bucket for sealed.fyi frontend

Resources:
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: sealed-fyi-frontend
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      VersioningConfiguration:
        Status: Enabled

  BucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref FrontendBucket
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: cloudfront.amazonaws.com
            Action: s3:GetObject
            Resource: !Sub ${FrontendBucket.Arn}/*
            Condition:
              StringEquals:
                AWS:SourceArn: !Sub arn:aws:cloudfront::${AWS::AccountId}:distribution/${CloudFrontDistributionId}
```

## ACM Certificate
- Domain: sealed.fyi
- Region: us-east-1 (required for CloudFront)
- Validation: DNS

## Route53 Configuration (if using)

```yaml
HostedZone:
  Type: AWS::Route53::HostedZone
  Properties:
    Name: sealed.fyi

ARecord:
  Type: AWS::Route53::RecordSet
  Properties:
    HostedZoneId: !Ref HostedZone
    Name: sealed.fyi
    Type: A
    AliasTarget:
      DNSName: !GetAtt CloudFrontDistribution.DomainName
      HostedZoneId: Z2FDTNDATAQYW2  # CloudFront hosted zone ID
```

## DNS Instructions (if not using Route53)
1. Create CNAME or ALIAS record
2. Point to CloudFront distribution domain
3. Wait for propagation

## SSL Certificate
1. Request certificate in ACM (us-east-1)
2. Add DNS validation records
3. Wait for validation
4. Use ARN in CloudFront

## Exit Criteria
- [ ] S3 bucket created
- [ ] Bucket policy allows CloudFront only
- [ ] ACM certificate provisioned and validated
- [ ] DNS configured
- [ ] Domain resolves to CloudFront
- [ ] Code reviewed
