# viaSocket skill · manage what a user has

> Part of the viaSocket skill: `https://flow.viasocket.com/documentation/skill.md`.

Calls of the package's `user = viasocket.user(userId)`:

| to                                                                                                                         | call                                          |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| list their connections (`isExpired: true` → reconnect in place, https://flow.viasocket.com/documentation/skill/connect.md) | `user.listConnections()`                      |
| disconnect an app (pause the flows built on it first)                                                                      | `user.revokeConnection(authId)`               |
| list their flows: enabled apps, subscriptions, automations (`id` is the `script_id`)                                       | `user.listFlows()`                            |
| pause (`2`), delete (`0`), resume or restore (`1`) one                                                                     | `user.setFlowStatus(scriptId, n)`             |
| rename one                                                                                                                 | `user.renameFlow(scriptId, { title })`        |
| change a subscription's handler                                                                                            | `user.updateSubscription(scriptId, { code })` |

The flow list gives each flow's `status` as `'active'`, `'paused'` or `'deleted'`.

A flow's runs of the last 30 days: `runHistory` in `https://flow.viasocket.com/documentation/automations.md`.
