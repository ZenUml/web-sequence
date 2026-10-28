const test = require('node:test');
const assert = require('node:assert/strict');
const { MIXPANEL_TOKEN, buildTrackPayload } = require('../track_payload');

test('targets the shared Mixpanel project 3373228 (Diagramly.Ai)', () => {
  assert.equal(MIXPANEL_TOKEN, '62d0ff230c6799db2a4d30a04fe5e1e2');
});

test('stamps product and passes caller properties through', () => {
  const { event, properties } = buildTrackPayload(
    { event: 'saveBtnClick', userId: 'u1', category: 'ui', label: 'new' },
    'web-sequence-local',
  );
  assert.equal(event, 'saveBtnClick');
  assert.deepEqual(properties, {
    distinct_id: 'u1',
    category: 'ui',
    label: 'new',
    displayProductName: 'FireWeb',
    product: 'web_sequence',
    firebase_project: 'web-sequence-local',
  });
});

test('callers cannot override the reserved keys', () => {
  const { properties } = buildTrackPayload(
    { event: 'x', userId: 'u1', product: 'passetta', firebase_project: 'p', displayProductName: 'y' },
    'staging-zenuml-27954',
  );
  assert.equal(properties.product, 'web_sequence');
  assert.equal(properties.firebase_project, 'staging-zenuml-27954');
  assert.equal(properties.displayProductName, 'FireWeb');
});
