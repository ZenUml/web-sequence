// Mixpanel project 3373228 "Diagramly.Ai": the shared ingest project that
// conf-app and Passetta also write to. Events are told apart by `product`.
// This is a public ingestion token (it only allows sending events).
const MIXPANEL_TOKEN = '62d0ff230c6799db2a4d30a04fe5e1e2';

// Build the Mixpanel event for a POST /track body. Caller properties pass
// through unchanged; the reserved keys are set last so a caller cannot
// override them (same rule as the Passetta sink).
function buildTrackPayload(body, firebaseProject) {
  const { event, userId, ...eventProperties } = body;
  return {
    event,
    properties: {
      distinct_id: userId,
      ...eventProperties,
      displayProductName: 'FireWeb',
      product: 'web_sequence',
      firebase_project: firebaseProject,
    },
  };
}

module.exports = { MIXPANEL_TOKEN, buildTrackPayload };
