# Phase 4, Stream E: Monitoring & Alerts

## Goal
Set up monitoring, logging, and alerting for production.

## Files
- `infrastructure/monitoring.yaml`

## CloudWatch Dashboards

### Main Dashboard
- API Gateway request count
- API Gateway latency (p50, p95, p99)
- API Gateway 4xx/5xx errors
- Lambda invocations per function
- Lambda errors per function
- Lambda duration
- DynamoDB read/write capacity
- DynamoDB throttling

## CloudWatch Alarms

```yaml
Resources:
  # API 5xx Errors
  Api5xxAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: sealed-fyi-api-5xx
      MetricName: 5XXError
      Namespace: AWS/ApiGateway
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 2
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic

  # Lambda Errors
  LambdaErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: sealed-fyi-lambda-errors
      MetricName: Errors
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 2
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic

  # DynamoDB Throttling
  DynamoThrottleAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: sealed-fyi-dynamo-throttle
      MetricName: ThrottledRequests
      Namespace: AWS/DynamoDB
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic

  # High Latency
  HighLatencyAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: sealed-fyi-high-latency
      MetricName: Latency
      Namespace: AWS/ApiGateway
      ExtendedStatistic: p95
      Period: 300
      EvaluationPeriods: 2
      Threshold: 3000
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref AlertTopic

  # SNS Topic for Alerts
  AlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: sealed-fyi-alerts
```

## Log Retention

```yaml
# Lambda Log Groups - Short retention for privacy
CreateTokenLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: /aws/lambda/sealed-fyi-create-token
    RetentionInDays: 7

CreateSecretLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: /aws/lambda/sealed-fyi-create-secret
    RetentionInDays: 7

# ... similar for other functions
```

## Logging Guidelines
**DO NOT LOG:**
- Ciphertext
- Secret IDs (or hash them)
- IP addresses
- User agents
- Referrers

**OK TO LOG:**
- Request counts
- Error types (not messages with IDs)
- Latency metrics
- Token validation failures (count only)

## Custom Metrics
Consider adding:
- Secrets created per hour
- Secrets retrieved per hour
- PoW solve time distribution
- Token expiry rejections

## Alert Channels
- SNS → Email
- SNS → Slack (via Lambda)
- SNS → PagerDuty (if needed)

## Exit Criteria
- [ ] Dashboard created
- [ ] All alarms configured
- [ ] Alert notifications working
- [ ] Log retention configured
- [ ] No sensitive data in logs
- [ ] Code reviewed
