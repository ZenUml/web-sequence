# How does it work

This functions runs on the firebase platform. It accept `POST` requests from
Paddle.

```
Paddle---POST-Request-->Firebase
```

### Config Paddle public key

- Download and save to file `paddle.pub_key`
- `firebase use --add`
- `firebase functions:config:set paddle.pub_key="$(cat paddle.pub_key)"`
- `cd functions && npm install`
- `firebase deploy`

### Config LaraSite host and public base url

- `firebase -P staging functions:config:set larasite.host=sequence-diagram-staging.zenuml.com`
- `firebase -P staging functions:config:set larasite.public_base_url=https://sequence-diagram-staging.zenuml.com`

- `firebase -P prod functions:config:set larasite.host=sequence-diagram.zenuml.com`
- `firebase -P prod functions:config:set larasite.public_base_url=https://zenuml.com/sequence-diagram`

### Webhook

find the webhook : https://console.firebase.google.com/u/0/project/staging-zenuml-27954/functions

### Webhook Support paddle product ids

- `firebase -P staging functions:config:set paddle.product_ids=552378,882893,882890,882891`
- `firebase -P prod functions:config:set paddle.product_ids=879334,551167,879927,883078,883082`
