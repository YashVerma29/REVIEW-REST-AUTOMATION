# viaSocket skill · actions, options and events

> Part of the viaSocket skill: `https://flow.viasocket.com/documentation/skill.md`.

With the user's `auth_id` (https://flow.viasocket.com/documentation/skill/connect.md) the product reads options from their account, runs the app's
actions and reacts to its events.

## Find what to call

1. **The app:** find it with `viasocket.catalog.search(name)`; its `serviceId` opens its page. Several matches? Show
   them and ask.
2. **Its page,** `https://flow.viasocket.com/documentation/<app_slug>.md` (or `<service_id>.md` from the search): its slug,
   which code names it by, its sign-in, its icon, and every action and trigger in one line (`?search=<words>`
   filters them). Choose the event the task needs.
3. **The event's page,** linked from the app's: its ids and version, its `inputData` as a TypeScript type.

## The order

Each id comes from the step before it. Keep on the server: the `auth_id` and the enabled app's `script_id` per user
and app, and each subscription's `script_id`.

```js
const user = viasocket.user(String(userId))
const serviceId = await viasocket.catalog.serviceIdFor('<app_slug>') // cached

// run an action (enable once per user and app)
const scriptId = (await user.findEnabled(serviceId)) ?? (await user.enable(serviceId, authId)).scriptId
const actionVersionId = await viasocket.catalog.versionIdFor(serviceId, '<event>', '<version>') // at run time, never a copied id
const { options } = await user.listOptions(actionVersionId, { fieldKey: '<dotted.key>', authId, existingFields }) // per PICK key
const result = await viasocket.runAction(scriptId, actionVersionId, actionInput)

// react to events (needs only the auth_id)
const authType = (await viasocket.catalog.versions(serviceId)).service.auth_type
const event = await viasocket.sampleEvent('<trigger_id>', authId, authType, triggerInput) // map the handler from this
const triggerVersionId = await viasocket.catalog.versionIdFor(serviceId, '<trigger event>', '<version>')
const { scriptId: subscriptionId } = await user.subscribe(triggerVersionId, { authId, inputData: triggerInput, code: handler }) // handler: Events below
```

`<event>` and `<version>` are what the event's page shows (`send-message`, `V107`); the sample event takes the
`trigger_id`. `actionInput` is the action's `inputData`; `triggerInput` is the trigger's own settings, from its page. A paused
enabled app (`status: 'paused'` in the flow list) is resumed with `user.setFlowStatus(scriptId, 1)`, never
enabled again.

## Ids, keys and values

- **Two ids per event.** Running, options and subscribing take the version's id
  (`action_version_id` / `trigger_version_id`), read at run time as above. The sample event, automations, the
  prebuilt UI and Connect's `actions` take the plain `action_id` / `trigger_id`.
  When `versionIdFor` warns, the app published a new version: reread the event's page and update anything its type changed.
- **Copy keys, never type them.** They are case-sensitive and differ between actions of one app (`spreadsheet_Id`,
  `spreadSheet_id`); nested keys are full dotted paths.
- **Decide every key.** Send it or leave it out on purpose; never drop a required one because it looks technical.
  A `PICK` key, or a choice whose right value depends on the end user's own account (their workspace, personal or
  shared, admin or not) → the end user chooses it on screen. Different on every run → the product's own data or its
  AI fills it. A constant in code only when one value is right for every user. Never a text box for an id, and
  never the first option because it came first. The report names each key's source, and for a constant, why.

## Options

- `fieldKey` is the full dotted path (`destination.channel_id`).
- `existingFields` holds the values chosen so far, nested like `inputData`; clear a key when what it depends on
  changes. The user's search text goes in it as `_searchText`; debounce it.
- Show `label`, send `value` verbatim. A `KEYS` key takes one entry per option `value`.

## Events

A subscription runs a **handler** on viaSocket once per event: a string of JavaScript with `context`, `fetch` and
`axios` in scope and the event at `context.req.body`, no imports. Bake in what it needs (a `script_id`, an id,
your API key) when you subscribe. Map its keys from a real event (`sampleEvent`) for the same connection; it wins over the page's sample.

Send the event to the product's own API, with its own auth header, so the endpoint stays protected:

```js
const handler = `await axios.post("https://your-app.com/api/viasocket-events", { event: context.req.body, user: "${userId}" },
  { headers: { authorization: "Bearer ${apiKeyForThisUser}" } })`
```

Or run another app's action, with no server of the product involved. Before subscribing, enable that app for this
user (its `script_id`) and read its `actionVersionId`, as in the order above; both are baked into the string, so
resubscribe (or update the handler) when that app publishes a new version:

```js
const handler = `
const body = context.req.body
const res = await axios.post("https://flow.sokt.io/func/${otherScriptId}", {
  action_version_id: "${otherActionVersionId}",
  inputData: { /* built from body: keys from a real sampleEvent, values decided as above */ }
})
const out = res.data
const failed = typeof out?.success === "boolean" && "data" in out ? !out.success : out?.success === false
if (failed) throw new Error(out?.message || "action failed")  // shows in the run history
return out`
```

- Save `{ userId, app, trigger_version_id, script_id, auth_id, inputData, handler }` in the same transaction: the
  flow list returns neither `inputData` nor the handler.
- A polled trigger takes `scheduledTime` (minutes, as a string) in `inputData`.
- `{ webhook: url }` instead of `{ code }` only when the developer asks for exactly that.

## When it goes wrong

| symptom                                                     | cause                                                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 401 / invalid token                                         | Wrong secret, a claim missing, or a `Bearer` prefix.                                            |
| Empty option list                                           | `fieldKey` is the leaf, `existingFields` is flat or misses a dependency.                        |
| Options throw `Auth data not found`                         | The connection is revoked or belongs to another user. Reconnect.                                |
| The app rejects the action                                  | An invented value for a `PICK` key, or a `WHEN` key sent while its condition is false.          |
| Code reads `undefined` from a result or an event            | The shape came from a sample, not from a real run or a real event.                              |
| `sampleEvent` answers `"No response"`                       | It got the `trigger_version_id`; it takes the `trigger_id`.                                     |
| The version is no longer the published one                  | The app published a newer version: reread the event's page, update the version and `inputData`. |
| The same event fires twice, or two `script_id`s for one app | Subscribed or enabled twice: check the saved record and the enabled app first.                  |
| A user's connections seem lost                              | A different `userId` (`unique_identifier`) for the same person.                                 |
