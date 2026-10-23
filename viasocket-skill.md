# viaSocket

Turn what the developer wants into a working feature in this session, starting from what the product's users need.
Each step points to a short page: fetch it when you reach it and read it whole.

**Ask the developer only for:** what to build, if unsaid; the org and project ids, if the prompt did not give them;
a value missing from `.env`; a sign-in with a test account; which app they mean when a name matches several;
allowing a blocked host. Do everything else yourself.

**Secrets stay on the server:** the signing secret, the embed token (except for the Connect popup and the prebuilt
UI), every `script_id`, every automation token and the test connection's ids never go in client code, a committed
file, a tool definition or a log.

## Steps

1. **Use the package.** `npm install viasocket-apps@^0.7.0` on the server and make every viaSocket call through it: its
   types are its documentation. Backend not on Node.js? Follow https://flow.viasocket.com/documentation/skill.md?format=http instead.

2. **Setup**, once per project: https://flow.viasocket.com/documentation/skill/setup.md.
3. **Plan, then build.** If the developer hasn't said what to build, suggest two or three ideas and build the one
   they pick. As soon as you know the app, ask for a test connection (https://flow.viasocket.com/documentation/skill/test-connection.md): run each call once on it
   and write later code from the real response; use a page's sample only until you have one. Then build from the row that fits:

   | the product needs to…                                               | read                                                                 |
   | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
   | let a user connect their app                                        | https://flow.viasocket.com/documentation/skill/connect.md            |
   | read options from a connected app, run its actions, react to events | https://flow.viasocket.com/documentation/skill/actions-and-events.md |
   | run steps across apps on an event, a schedule or a webhook          | https://flow.viasocket.com/documentation/automations.md              |
   | add AI behind a feature or a chat assistant                         | https://flow.viasocket.com/documentation/ai.md                       |
   | let users build their own integrations in viaSocket's screens       | https://flow.viasocket.com/documentation/embed.md                    |
   | show every app and any action's form in its own screens             | https://flow.viasocket.com/documentation/catalog-api.md              |
   | use Run AI Model, Delay or Memory as a step                         | https://flow.viasocket.com/documentation/skill/built-in-actions.md   |
   | manage a user's connections and flows                               | https://flow.viasocket.com/documentation/skill/manage.md             |

4. **Check, then report.** Run the check script over the integration's code and fix every FAIL; it catches
   invented ids and hand-built URLs (it needs Node.js; without it, say the check was not run):
   `curl -fsSL https://flow.viasocket.com/viasocket-check.mjs -o viasocket-check.mjs && node viasocket-check.mjs <folder>`.
   Report what you built, the script's output, one real call's response, and anything
   left for the developer (a value only they know, a sign-in only they can do).

### Finished when

Each line that applies is decided and the report says how. "Integrate Slack" covers all of them for the actions
and events in play, whether or not the developer named each one.

- **Who connects:** the product's own user, through a Connect button with the app's icon; the `auth_id` stored per
  user, and reconnected in place when it expires. In a two-sided product the customer connects, never their visitor.
- **Where each value comes from:** every key of every `inputData`, as https://flow.viasocket.com/documentation/skill/actions-and-events.md
  decides it: the user on screen, the product's data or AI per run, or a constant only when it is right for every user.
- **Who picks the action:** the developer in code, the user from a list, or the product's AI from tool definitions.
- **Where it runs:** actions from the server; events through a handler on viaSocket, its record saved; the browser
  holds a token only for the Connect popup, the prebuilt UI and an AI chat's websocket.
- **Proof:** the check script's output and one real call's response.
