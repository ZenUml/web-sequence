# Firebase Emulator Testing Guide

This guide explains how to run the Firebase emulator locally and test your Firebase functions using cURL.

## Running the Firebase Emulator

1. Navigate to your project root directory:
   ```bash
   cd /Users/pengxiao/workspaces/zenuml/web-sequence
   ```

2. Start the Firebase emulator:
   ```bash
   firebase emulators:start
   ```

   This will start the emulator and display the available endpoints in the terminal.

## Accessing the Emulator UI

The Firebase Emulator Suite includes a web-based UI that provides a dashboard for all your emulated services:

1. When you start the emulators, look for a message like:
   ```
   ✔  emulators: All emulators ready! It is now safe to connect.
   i  emulators: View Emulator UI at http://localhost:4000/
   ```

2. Open the provided URL in your browser (typically http://localhost:4000)

3. The UI provides:
   - A list of all your Cloud Functions endpoints
   - The ability to view logs for each function
   - A way to test functions directly from the UI
   - Firestore database viewer (if enabled)
   - Authentication emulator (if enabled)

This UI makes it easier to debug and test your Firebase functions without having to use cURL commands for everything.

## Testing Firebase Functions with cURL

### Testing the Info Endpoint

To verify that the emulator is running correctly, test the `/info` endpoint:

```bash
curl -X POST \
  http://localhost:5000/info \
  -H 'Content-Type: application/json' \
  -d '{"event": {"event": "testEvent", "category": "test"}, "userId": "test-user"}'
```

You should receive a response like:
```
Hello from web-sequence-local!
```

### Testing the Track Endpoint

To test the `/track` endpoint:

```bash
curl -X POST \
  http://localhost:5000/track \
  -H 'Content-Type: application/json' \
  -d '{"event": {"event": "testEvent", "category": "test"}, "userId": "test-user"}'
```

You should receive a response like:
```
Event tracked successfully
```

### Testing Different Payload Formats

The track endpoint supports two different payload formats:

1. Object format (recommended):
   ```bash
   curl -X POST \
     http://localhost:5002/track \
     -H 'Content-Type: application/json' \
     -d '{"event": {"event": "testEvent", "category": "test"}, "userId": "test-user"}'
   ```

2. String format (legacy):
   ```bash
   curl -X POST \
     http://localhost:5002/track \
     -H 'Content-Type: application/json' \
     -d '{"event": "testEvent", "category": "test", "userId": "test-user"}'
   ```

## Monitoring Logs

While the emulator is running, you can monitor the logs in the terminal. These logs will show:

1. Incoming requests
2. Function execution details
3. Any errors or warnings
4. Mixpanel tracking information

## Troubleshooting

### Functions Emulator Shows as "OFF" in the UI

If the Functions emulator shows as "OFF" in the Emulator UI:

1. Make sure your `firebase.json` file has the proper emulators configuration:
   ```json
   "emulators": {
     "functions": {
       "port": 5002
     },
     "hosting": {
       "port": 5000
     },
     "ui": {
       "enabled": true,
       "port": 4000
     }
   }
   ```

2. Try starting the emulator with the explicit `--only` flag:
   ```bash
   firebase emulators:start --only functions
   ```

3. Check the terminal output for any error messages related to the Functions emulator.

### Timeout Issues with the Track Endpoint

If you encounter a timeout issue with the `/track` endpoint:

1. Check the emulator logs for any errors
2. Verify that the function is responding immediately without waiting for Mixpanel
3. Make sure the payload format is correct

## Notes on URL Structure

- Direct function URLs: `http://localhost:5002/{functionName}`
- If you've added rewrite rules in firebase.json, you can also use: `http://localhost:5000/{path}`

Remember to stop the emulator when you're done testing by pressing `Ctrl+C` in the terminal.
