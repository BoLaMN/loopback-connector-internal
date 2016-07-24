# loopback-connector-internal

Internal server to server communication for loopback (wip)

* npm install loopback-connector-internal --save

### Adapter Configuration (dataources.json)

#### AWS SQS

```cson
server2:
  name: 'server2'
  connector: 'internal'
  adapter: 'sqs'
  subscribe: 'https://sqs.ap-southeast-2.amazonaws.com/1234/server1'
  publish: 'https://sqs.ap-southeast-2.amazonaws.com/1234/server2'
  options:
    region: 'ap-southeast-2'
    accessKeyId: '1234'
    secretAccessKey: 'ABCD'
```
