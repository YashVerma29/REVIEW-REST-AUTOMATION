# viaSocket skill · connection setup

> Part of the viaSocket skill: `https://flow.viasocket.com/documentation/skill.md`.

A user connects one of their apps once, from the product's own screen; the result is an `auth_id`, stored per
user and app on the server. An app without sign-in has no Connect button: its `auth_id` is `NoAuth`.

## 1. The token endpoint (server)

The browser gets its embed token only from here, behind the product's login:

```js
app.get('/api/viasocket/token', requireLogin, async (req, res) => {
  const slugs = String(req.query.apps || '')
    .split(',')
    .filter(Boolean) // ?apps=slack,google-sheets
  const serviceIds = Object.fromEntries(await Promise.all(slugs.map(async (slug) => [slug, await viasocket.catalog.serviceIdFor(slug)])))
  res.json({ token: await viasocket.user(String(req.user.id)).token(), serviceIds }) // the user id is always a string
})
```

## 2. The Connect button (browser)

It shows the app's icon and name.

```js
import { connect, loadConnectScript } from 'viasocket-apps/browser'

// on page load, not in the click: the popup must open straight from the click or the browser blocks it
const { token, serviceIds } = await fetch('/api/viasocket/token?apps=<app_slug>').then((r) => r.json())
loadConnectScript()

const save = (authId) =>
  fetch('/api/viasocket/connected', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: '<app_slug>', authId })
  }) // store per user and app

button.onclick = async () => {
  try {
    const { authId } = await connect({
      embedToken: token,
      serviceId: serviceIds['<app_slug>'],
      actions: ['<action_id or trigger_id>'], // consent asks only these events' scopes
      skipActionSelection: true,
      onLateSuccess: ({ authId }) => save(authId) // finished after connect() rejected with 'closed'
      // authId: '<auth_id>' reconnects an expired connection in place
    })
    await save(authId)
  } catch (error) {
    if (error.code !== 'closed') showError(error.message) // 'closed' is not a failure: a success may still follow
  }
}
```

`connect()` rejects with a `code`: `closed`, `rejected`, `invalid`, `script` or `unavailable`.

## Rules

- Only `connect()` opens the popup: a hand-built
  viasocket URL, `window.open` or an iframe shows "Page not found".
- An expired connection (`isExpired: true` in the user's connections) is reconnected in place with its `authId`,
  so nothing stored against it changes.
- One user's `auth_id` never serves another user. If the product's end users serve customers of their own, the end
  user connects, never their customer. It ends in `_<service_id>` but is one opaque value.
- Apps are named by slug in code (`slack`, `google-sheets`): exact and case-sensitive (`ZohoFSM`, not `zohofsm`); some
  look like ids. `viasocket.catalog.serviceIdFor(slug)` turns it into the `service_id` the calls take; an unknown slug is an
  error to report, not to retry. Never pass the app's name, or a `service_id` with a name joined on.

Next, use the connection: https://flow.viasocket.com/documentation/skill/actions-and-events.md.
