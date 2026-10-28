// Mixpanel project 3373228 "Diagramly.Ai": the shared ingest project that
// conf-app, Mini Site, Passetta, docat and diagramly.ai also write to. Events are
// told apart by `product_type` (the conf-app convention).
// This is a public ingestion token (it only allows sending events).
const MIXPANEL_TOKEN = '62d0ff230c6799db2a4d30a04fe5e1e2';

const PRODUCT_TYPE = 'web-sequence';

// Legacy camelCase names -> snake_case object_action names. The rename lives on
// the server because installed Chrome extensions keep sending the old names
// until users update; new web builds send the target names directly.
const LEGACY_EVENT_NAMES = {
  pageView: 'app_opened',
  loggedIn: 'user_logged_in',
  loggedOut: 'user_logged_out',
  shareLink: 'share_link_created',
  saveBtnClick: 'diagram_save_clicked',
  saveFailed: 'diagram_save_failed',
  itemsImported: 'items_imported',
  exportItems: 'items_exported',
  pledgeModalSeen: 'pledge_modal_shown',
  'Free Limit': 'free_limit_reached',
};

const DOWNLOAD_FORMATS = { downloadPng: 'png', downloadSvg: 'svg' };
const UPDATE_PREF_PREFIX = 'updatePref-';

function toSnakeCase(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

// Map an incoming event name to its target name plus any properties the old
// name encoded (download format, preference key).
function mapEventName(name) {
  if (LEGACY_EVENT_NAMES[name]) {
    return { event: LEGACY_EVENT_NAMES[name], properties: {} };
  }
  if (DOWNLOAD_FORMATS[name]) {
    return { event: 'diagram_downloaded', properties: { format: DOWNLOAD_FORMATS[name] } };
  }
  if (typeof name === 'string' && name.startsWith(UPDATE_PREF_PREFIX)) {
    return {
      event: 'preference_updated',
      properties: { pref: name.slice(UPDATE_PREF_PREFIX.length) },
    };
  }
  return { event: toSnakeCase(name), properties: {} };
}

// A usable id: a non-empty string that is not a stringified null.
function usableId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  return trimmed;
}

// Build the Mixpanel event for a POST /track body. Caller properties pass
// through, with the legacy `category` / `label` renamed to `feature_area` /
// `event_label`. The reserved keys are set last so a caller cannot override them.
// distinct_id is the Firebase uid when signed in, else the client's anonymous
// id; with neither it is omitted rather than sent as null or a shared value.
function buildTrackPayload(body, firebaseProject) {
  const {
    event: incomingEvent,
    userId,
    anonId,
    category,
    label,
    distinct_id: _ignoredDistinctId,
    displayProductName: _legacyDisplayProductName,
    product: _legacyProduct,
    ...eventProperties
  } = body;
  const { event, properties: nameProperties } = mapEventName(incomingEvent);

  const properties = { ...eventProperties, ...nameProperties };
  if (category !== undefined && properties.feature_area === undefined) {
    properties.feature_area = category;
  }
  if (label !== undefined && properties.event_label === undefined) {
    properties.event_label = label;
  }

  const anon = usableId(anonId);
  if (anon) properties.anon_id = anon;
  properties.product_type = PRODUCT_TYPE;
  properties.firebase_project = firebaseProject;
  const distinctId = usableId(userId) || anon;
  if (distinctId) properties.distinct_id = distinctId;

  return { event, properties };
}

module.exports = { MIXPANEL_TOKEN, buildTrackPayload, mapEventName };
