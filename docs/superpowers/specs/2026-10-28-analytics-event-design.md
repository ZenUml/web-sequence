# web/ analytics event design (modelled on conf-app)

Status: DRAFT for review. D1 and D4 (the rename map, section 9) are implemented in `functions/track_payload.js`. Section 10 (first activity events) is implemented in the web client; the rest is not built.
Section 9 is the shipped naming and wins where sections 5–6 differ (hard cutover, no dual-fire).
Reference: `conf-app/docs/analytics/events-catalog.md`, `conf-app/src/utils/window.ts`.

## 1. Why

After the 2026-06-18 cutover the rewrite lost its client events (`WA:*` fell to 0 from the week of 2026-06-22).
Remaining server events (`pageView`, `landed_in_editor`, `first_edit`, ...) cannot answer
"are users more active?": no stable anonymous id, no creation/save/export funnel, no render
health, no session length, no plan or version dimension.

## 2. What conf-app does that we copy

| conf-app rule | Applied here |
|---|---|
| `noun_verb_pastTense` names; lifecycle triples `_started` / `_succeeded` / `_failed` or `_cancelled` | Section 5 |
| Required call-site props `feature_area` + `surface`; everything else auto-enriched in one place | Section 4 |
| Join key per flow (`creation_flow_id`) | `diagram_flow_id` |
| Close/cancel event sent with `sendBeacon` | `editor_session_ended` on `pagehide` |
| Error events never sampled; high-volume diagnostics sampled, with `sample_rate` stamped | `diagram_render_*` |
| Build-time `app_version` / `app_commit` on every event | Section 4 |
| Internal-traffic exclusion list | `is_internal` property |
| Catalog doc with a "History" note on every rename | Section 7 |
| Phase 1 is non-breaking: old names keep firing while new ones ship | Section 6 |

## 3. Current state (web/)

```
 UI handler --track(name, {category,label})--> useAnalytics --> analytics.emit
                                                     |-> POST /track (functions/index.js -> track_payload.js)
                                                     |      event renamed (section 9)
                                                     |      distinct_id = userId ?? anonId (omitted when neither)
                                                     |      product_type = 'web-sequence'
                                                     |-> window.dataLayer / window.mixpanel  (never loaded: stub)
```

Facts that shape the design:
- `/track` forwards every extra body field to Mixpanel unchanged, so new properties need no backend change.
- `distinct_id = userId` is null for signed-out users, who are most users. Fix client-side: send `userId = uid ?? anon_id`.
- Until 2026-10-29 `/track` wrote to Mixpanel project "Confluence Analytics(new)" (token `78617e65…`), which the team's Mixpanel login cannot open. Decision D1 below moves it.
- Names today are camelCase and mixed (`saveBtnClick`, `Free Limit`, `updatePref-<key>`), and `category`/`label` carry unstructured meaning.

## 4. Common properties

Required at call site:

| Property | Values |
|---|---|
| `feature_area` | `editor` `library` `share` `auth` `billing` `export` `feedback` `system` |
| `surface` | `editor` `hub` `share_view` `embed` `modal` `header` `extension` |

Auto-added inside `emit` (one place, `web/src/services/analytics.ts`):

| Property | Source |
|---|---|
| `user_id` | `uid ?? anon_id` (also sent as `userId` for `distinct_id`) |
| `anon_id` | random UUID in localStorage, stable across sessions |
| `is_authenticated` | `uid != null` |
| `plan` | `free` / `pro` from subscription store |
| `runtime` | `web` / `extension` / `embed` (from `runtimeMode`) |
| `env` | `prod` / `staging` / `local` |
| `app_version`, `app_commit` | build-time env |
| `viewport` | `mobile` / `tablet` / `desktop` |
| `product_type` | constant `web-sequence`, set server-side in `/track` (the conf-app convention in project 3373228) |
| `is_internal` | `true` for the owner's traffic (localStorage flag or `?internal=1`), so queries can exclude it |

## 5. Event catalog

### 5.1 Session and entry

| Event | Trigger | Extra props | Replaces |
|---|---|---|---|
| `app_opened` | once per app mount | `entry_kind`: `editor_resume` `editor_sample` `hub` `shared_link` `embed`; `is_returning`; `referrer_type`: `direct` `search` `docs` `extension` `other` | `pageView`, `landed_in_editor`, `hub_opened{landing-param}` |
| `hub_opened` | user opens the diagram hub | `source`: `breadcrumb` `landing_param` | same name, kept |

### 5.2 Diagram lifecycle (core activity events)

All carry `diagram_flow_id` (UUID per editor mount, shared by every event of that editing session).

| Event | Trigger | Extra props | Replaces |
|---|---|---|---|
| `diagram_create_started` | new diagram begins | `creation_origin`: `new_button` `sample` `template` `import` `boot` | none |
| `diagram_opened` | existing diagram opened | `source`: `hub` `url` `share` `resume` | none |
| `diagram_first_edit` | first DSL edit in a mount | `time_to_first_edit_ms` | `first_edit` |
| `diagram_save_succeeded` | save completes | `operation_mode`: `create` `edit`; `destination`: `local` `cloud`; `dsl_length_bucket` | `saveBtnClick` |
| `diagram_save_failed` | save rejected | `error_code`, `destination` | `saveFailed` |
| `diagram_deleted` | delete confirmed | `source`: `hub` `editor` | none |
| `editor_session_ended` | `pagehide` / route leave, via `sendBeacon` | `editor_open_duration_ms`, `edit_count`, `had_changes`, `saved`, `close_source`: `navigate` `hub` `unload` | none |

### 5.3 Render health (sampled)

| Event | Trigger | Extra props |
|---|---|---|
| `diagram_render_succeeded` | preview render completes | `render_ms`, `dsl_length_bucket`, `participant_count_bucket`, `sample_rate` |
| `diagram_render_failed` | parser or render error (never sampled) | `error_code`, `phase`: `parse` `layout` `iframe`, `dsl_length_bucket` |

Sample `diagram_render_succeeded` at 0.1. Hide-tab loads get `tab_hidden: true`, as in conf-app.

### 5.4 Export and share

| Event | Trigger | Extra props | Replaces |
|---|---|---|---|
| `diagram_export_requested` | export clicked | `format`: `png` `svg` `pdf` `json` `mermaid`; `source`: `toolbar` `menu` | `downloadPng`, `downloadSvg`, `exportItems` |
| `diagram_export_succeeded` / `diagram_export_failed` | result | `format`, `duration_ms`, `error_code` on failure | none |
| `share_link_created` | share link generated | `visibility` | `shareLink` |
| `shared_diagram_viewed` | share view loaded | `load_ms`, `outcome`: `ok` `not_found` `forbidden` | none |
| `library_import_succeeded` | items imported | `item_count` | `itemsImported` |

### 5.5 Auth and billing

| Event | Trigger | Extra props | Replaces |
|---|---|---|---|
| `login_started` / `login_succeeded` / `login_failed` | auth flow | `provider`, `error_code` | `loggedIn` |
| `logout_completed` | sign out | none | `loggedOut` |
| `paywall_triggered` | gate fires | `trigger`: `diagram_limit` `feature_gate`, `limit_value` | `Free Limit` |
| `upgrade_modal_shown` / `upgrade_modal_dismissed` | pricing modal | `source` | none |
| `checkout_opened` | Paddle checkout opened | `plan`, `source` | none |

### 5.6 Feedback, settings, errors

| Event | Trigger | Extra props | Replaces |
|---|---|---|---|
| `bug_report_opened` / `bug_report_submitted` | feedback dialog | `source`, `included_dsl` | same names, `label` becomes `source` |
| `preference_changed` | setting changed | `pref_key`, `pref_value` | `updatePref-<key>` (one event, not one per key) |
| `app_error` | uncaught error boundary | `error_code`, `where` | none |

## 6. Rollout (conf-app "Phase 1" style)

1. Add `anon_id` and the auto-enrichment inside `emit`; send `userId = uid ?? anon_id`. Legacy events keep firing unchanged and gain the new common props.
2. Add new events next to old ones. Dual-fire for at least 4 weeks so reports can be rebuilt.
3. Mark legacy names deprecated in the catalog; stop emitting them after the dashboards move.
4. Add a unit test per event (name + required props) and one Playwright check that the editor journey posts the expected `/track` bodies.

## 7. Documentation

Create `web/docs/analytics-events-catalog.md` from section 5 once approved; every later rename gets a History note with the date, as in conf-app.

## 8. Decisions needed

- D1 sink — DECIDED 2026-10-29: `/track` stays the only sink and now writes to project 3373228 "Diagramly.Ai", the project conf-app and Passetta share. `functions/track_payload.js` stamps `product_type = web-sequence` and `firebase_project` (staging vs prod) as reserved keys a caller cannot override (an earlier draft used `product = web_sequence`; conf-app uses `product_type`, so that key was replaced before deploy). Data sent before the deploy stays in the old project. Filter every web-sequence query with `product_type = web-sequence`.
- D2 `is_internal`: localStorage flag set by `?internal=1`, or a hard-coded uid allowlist.
- D3 whether `diagram_render_succeeded` ships in the first PR or waits for the preview RPC refactor.
- D4 names — DECIDED 2026-10-29: hard cutover, no dual-send. Section 9.

## 9. Shipped rename map (2026-10-29)

`/track` renames on the server, because installed Chrome extensions keep sending old names; new web builds send the new names directly.

| Old name | New name | Extra property |
|---|---|---|
| `pageView` | `app_opened` | |
| `loggedIn` / `loggedOut` | `user_logged_in` / `user_logged_out` | |
| `shareLink` | `share_link_created` | |
| `saveBtnClick` / `saveFailed` | `diagram_save_clicked` / `diagram_save_failed` | |
| `itemsImported` / `exportItems` | `items_imported` / `items_exported` | |
| `downloadPng` / `downloadSvg` | `diagram_downloaded` | `format`: `png` / `svg` |
| `updatePref-<key>` | `preference_updated` | `pref`: `<key>` |
| `pledgeModalSeen` | `pledge_modal_shown` | |
| `Free Limit` | `free_limit_reached` | |
| any other camelCase or spaced name | snake_case of it | |

snake_case names (`hub_opened`, `first_edit`, `landed_in_editor`, `bug_report_*`) pass through unchanged.

Properties: `category` becomes `feature_area`, `label` becomes `event_label`, `displayProductName` and `product` are dropped, `anonId` arrives as `anon_id`. The web client sends `anonId` (a localStorage UUID, `web/src/services/anonId.ts`) and `app_version` on every POST.

## 10. Shipped activity events (2026-10-29)

The first slice of section 5.2, chosen because it measures activity directly: a completed save and the length of an editor visit.

| Event | Trigger | Properties |
|---|---|---|
| `diagram_save_succeeded` | a save completes (after the store marks it saved) | `feature_area: editor`, `destination`: `cloud` / `queued` / `local` |
| `editor_session_ended` | end of one editor visit: back to the hub in-app, or `pagehide`; not sent from the hub or an embed | `feature_area: editor`, `close_source`: `hub` / `unload`, `editor_open_duration_ms` (from when the editor showed), `edit_count` (DSL edits), `had_unsaved_changes` |

Every `/track` body now also carries `is_authenticated` (uid present) and `runtime` (`web` / `extension`), added in `emit`.

`/track` is sent with `fetch(..., { keepalive: true })` so the `pagehide` POST finishes after the page unloads. A reload of the editor also ends a session; that is intended.

Not yet built from section 5: `diagram_create_started`, `diagram_opened`, `diagram_flow_id`, render health (5.3), export outcomes (5.4), login and billing outcomes (5.5), `surface`, `plan`, `viewport`, `is_internal`.

Weekly activity query (project 3373228): filter `product_type = web-sequence`; count unique users of `diagram_save_succeeded`, and sum `editor_open_duration_ms` of `editor_session_ended` per user.

