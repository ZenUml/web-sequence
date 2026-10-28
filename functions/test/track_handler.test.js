// Integration test for the deployed handler: exports.track in index.js, with the
// Mixpanel client replaced so nothing reaches the live project.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.FUNCTIONS_EMULATOR = 'true';
process.env.GCLOUD_PROJECT = 'staging-zenuml-27954';

const sent = [];
let initToken = null;
const mixpanelPath = require.resolve('mixpanel');
require.cache[mixpanelPath] = {
  id: mixpanelPath,
  filename: mixpanelPath,
  loaded: true,
  exports: {
    init(token) {
      initToken = token;
      return { track: (event, properties) => sent.push({ event, properties }) };
    },
  },
};

const { track } = require('../index');

function call(body) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      send(text) { resolve({ status: this.statusCode, text }); },
    };
    track({ method: 'POST', body, headers: {} }, res);
  });
}

test('initialises Mixpanel with the project 3373228 token', () => {
  assert.equal(initToken, '62d0ff230c6799db2a4d30a04fe5e1e2');
});

test('POST /track from an old extension lands renamed with product_type', async () => {
  sent.length = 0;
  const res = await call({ event: 'saveBtnClick', userId: null, anonId: 'anon-1', category: 'ui', label: 'new' });
  assert.equal(res.status, 200);
  assert.deepEqual(sent, [{
    event: 'diagram_save_clicked',
    properties: {
      feature_area: 'ui',
      event_label: 'new',
      anon_id: 'anon-1',
      product_type: 'web-sequence',
      firebase_project: 'staging-zenuml-27954',
      distinct_id: 'anon-1',
    },
  }]);
});

test('POST /track without an event is rejected and sends nothing', async () => {
  sent.length = 0;
  const res = await call({ userId: 'u1' });
  assert.equal(res.status, 400);
  assert.equal(sent.length, 0);
});
