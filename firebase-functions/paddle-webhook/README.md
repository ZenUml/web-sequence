### Config Paddle public key
- Download and save to file `paddle.pub_key`
- `firebase use --add`
- `firebase functions:config:set paddle.pub_key="$(cat paddle.pub_key)"`
- `cd functions && npm install`
- `firebase deploy`
