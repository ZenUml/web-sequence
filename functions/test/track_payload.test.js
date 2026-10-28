const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MIXPANEL_TOKEN,
  buildTrackPayload,
  mapEventName,
} = require('../track_payload');

test('targets the shared Mixpanel project 3373228 (Diagramly.Ai)', () => {
  assert.equal(MIXPANEL_TOKEN, '62d0ff230c6799db2a4d30a04fe5e1e2');
});

// Every legacy name an old extension or old web build can still send, and the
// snake_case object_action name it lands under in project 3373228.
const LEGACY_RENAMES = [
  ['pageView', 'app_opened', {}],
  ['loggedIn', 'user_logged_in', {}],
  ['loggedOut', 'user_logged_out', {}],
  ['shareLink', 'share_link_created', {}],
  ['saveBtnClick', 'diagram_save_clicked', {}],
  ['saveFailed', 'diagram_save_failed', {}],
  ['itemsImported', 'items_imported', {}],
  ['exportItems', 'items_exported', {}],
  ['downloadPng', 'diagram_downloaded', { format: 'png' }],
  ['downloadSvg', 'diagram_downloaded', { format: 'svg' }],
  ['pledgeModalSeen', 'pledge_modal_shown', {}],
  ['Free Limit', 'free_limit_reached', {}],
  ['updatePref-editorTheme', 'preference_updated', { pref: 'editorTheme' }],
  ['updatePref-autoPreview', 'preference_updated', { pref: 'autoPreview' }],
];

for (const [legacy, target, extra] of LEGACY_RENAMES) {
  test(`renames ${legacy} -> ${target}`, () => {
    assert.deepEqual(mapEventName(legacy), { event: target, properties: extra });
  });
}

test('new names map to themselves, so old and new clients land on one event', () => {
  for (const [, target, extra] of LEGACY_RENAMES) {
    if (target === 'diagram_downloaded' || target === 'preference_updated') continue;
    assert.deepEqual(mapEventName(target), { event: target, properties: {} });
    assert.deepEqual(extra, {});
  }
});

test('snake_case names pass through unchanged', () => {
  for (const name of [
    'hub_opened',
    'first_edit',
    'landed_in_editor',
    'bug_report_opened',
    'bug_report_submitted',
    'diagram_downloaded',
    'preference_updated',
  ]) {
    assert.deepEqual(mapEventName(name), { event: name, properties: {} });
  }
});

test('unknown camelCase and spaced names convert to snake_case', () => {
  assert.equal(mapEventName('someNewThing').event, 'some_new_thing');
  assert.equal(mapEventName('Mixed Case-Name').event, 'mixed_case_name');
  assert.equal(mapEventName('openHTMLExport').event, 'open_html_export');
});

test('builds the full payload: renamed event, product_type, mapped properties', () => {
  const { event, properties } = buildTrackPayload(
    {
      event: 'saveBtnClick',
      userId: 'u1',
      anonId: 'anon-1',
      category: 'ui',
      label: 'new',
      app_version: '2026.6.7',
    },
    'web-sequence-local',
  );
  assert.equal(event, 'diagram_save_clicked');
  assert.deepEqual(properties, {
    feature_area: 'ui',
    event_label: 'new',
    app_version: '2026.6.7',
    anon_id: 'anon-1',
    product_type: 'web-sequence',
    firebase_project: 'web-sequence-local',
    distinct_id: 'u1',
  });
});

test('drops the legacy discriminators displayProductName and product', () => {
  const { properties } = buildTrackPayload(
    { event: 'pageView', userId: 'u1', displayProductName: 'FireWeb', product: 'web_sequence' },
    'p',
  );
  assert.equal('displayProductName' in properties, false);
  assert.equal('product' in properties, false);
});

test('callers cannot override the reserved keys', () => {
  const { properties } = buildTrackPayload(
    {
      event: 'x',
      userId: 'u1',
      product_type: 'lite',
      firebase_project: 'p',
      distinct_id: 'spoofed',
    },
    'staging-zenuml-27954',
  );
  assert.equal(properties.product_type, 'web-sequence');
  assert.equal(properties.firebase_project, 'staging-zenuml-27954');
  assert.equal(properties.distinct_id, 'u1');
});

test('download events carry format; updatePref carries pref and the value label', () => {
  const png = buildTrackPayload({ event: 'downloadPng', userId: 'u1', category: 'ui' }, 'p');
  assert.equal(png.event, 'diagram_downloaded');
  assert.equal(png.properties.format, 'png');
  assert.equal(png.properties.feature_area, 'ui');

  const pref = buildTrackPayload(
    { event: 'updatePref-editorTheme', userId: 'u1', category: 'ui', label: 'dracula' },
    'p',
  );
  assert.equal(pref.event, 'preference_updated');
  assert.equal(pref.properties.pref, 'editorTheme');
  assert.equal(pref.properties.event_label, 'dracula');
});

test('a caller-sent feature_area / event_label wins over the legacy category / label', () => {
  const { properties } = buildTrackPayload(
    { event: 'x', userId: 'u1', category: 'old', feature_area: 'editor', label: 'l', event_label: 'e' },
    'p',
  );
  assert.equal(properties.feature_area, 'editor');
  assert.equal(properties.event_label, 'e');
  assert.equal('category' in properties, false);
  assert.equal('label' in properties, false);
});

test('signed-out: distinct_id is the client anonymous id', () => {
  const { properties } = buildTrackPayload(
    { event: 'pageView', userId: null, anonId: 'anon-xyz' },
    'p',
  );
  assert.equal(properties.distinct_id, 'anon-xyz');
  assert.equal(properties.anon_id, 'anon-xyz');
});

test('signed-in: distinct_id is the Firebase uid even when anonId is present', () => {
  const { properties } = buildTrackPayload(
    { event: 'pageView', userId: 'uid-1', anonId: 'anon-xyz' },
    'p',
  );
  assert.equal(properties.distinct_id, 'uid-1');
});

test('no uid and no anonId (old extension, signed out): distinct_id is omitted, never null', () => {
  for (const userId of [null, undefined, '', 'null', 'undefined']) {
    const { properties } = buildTrackPayload({ event: 'pageView', userId }, 'p');
    assert.equal('distinct_id' in properties, false, `userId=${String(userId)}`);
  }
});
