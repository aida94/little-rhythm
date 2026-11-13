# Little Rhythm

A web app to track sleep, meals and potty for your kids. It runs in Chrome, can be installed on a phone like an app, and works offline.

## Where the data is

- Everything you log is saved in the browser on the device you use (in Chrome's local storage). Nothing is sent to a server.
- Each device has its own data. The laptop and the phone do not share entries.
- To move data or keep a copy, open **Settings** (the gear at the top right), tap **Download backup**, and use **Restore backup** on the other device.
- If you clear Chrome's site data, or delete the installed app, the entries are gone. Download a backup now and then.

## Files

| File | What it does |
|---|---|
| `index.html` | The whole app: screens, styles and logic |
| `manifest.webmanifest` | App name, icon and colors, so Chrome can install it |
| `sw.js` | Service worker. It saves the app files so the app opens without internet |
| `icons/` | App icons |

## Run it on your Mac

```bash
cd little-rhythm
python3 -m http.server 8765
```

Open http://localhost:8765 in Chrome. To install it on the Mac, click the install icon at the right of the address bar.

## Put it on your phone

A phone can only install the app from an **https** address, so the folder needs to be hosted online. The hosted page holds only the app, never your data.

Easiest option, **Netlify Drop**: open https://app.netlify.com/drop, sign in, and drag the `little-rhythm` folder onto the page. You get an https link.

Then on the phone:

- **Android, Chrome**: open the link, tap the ⋮ menu, then **Install app**.
- **iPhone, Chrome or Safari**: open the link, tap **Share**, then **Add to Home Screen**.

On iPhone, the home-screen app keeps its own storage, separate from the browser tab. Install it first, then log only in the installed app.

## Changing the app later

After you edit `index.html`, change `VERSION` at the top of `sw.js` (for example `lr-v2` to `lr-v3`) and upload the folder again. The phone gets the new version the next time the app opens online. Your data stays.
