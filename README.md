Camp 2026 Consent Lookup — setup guide
This is a small installable phone app (a "PWA"). It shows the same lookup,
medical-flag summary and no-photo-consent list as your Excel workbook, but
on a phone, and it keeps working with no signal once it's synced.
It is free to run. There are two one-off setup jobs:
Put the app online somewhere (so a phone can install it) — GitHub Pages, free.
Point it at your data in Dropbox.
Nothing about your participants' data is ever stored on GitHub — GitHub only
hosts the empty app shell (the code in this folder). The actual data is
fetched straight from your private Dropbox link into each phone, and stays
on that phone.
---
Part 1 — Put the app online (GitHub Pages)
Go to https://github.com and create a free account if you don't have one.
Click New repository. Name it something like `camp-consent-app`.
Set it to Public (this only makes the empty app code public, not
your data — see note above). Click Create repository.
On the new repo page, click Add file → Upload files, and drag in
every file from this folder (`index.html`, `app.js`, `styles.css`,
`manifest.json`, `sw.js`, and the `icons` folder). Commit the upload.
Go to Settings → Pages (left sidebar). Under "Build and deployment",
set Source to `Deploy from a branch`, branch `main`, folder `/root`.
Click Save.
Wait a minute, then refresh — GitHub shows you a URL like:
`https://yourusername.github.io/camp-consent-app/`
That's your app's address. Open it on your phone's browser.
(If this feels fiddly, ask any GitHub-savvy leader to do steps 1–4 once —
after that, nobody else needs to touch GitHub again.)
Part 2 — Get your data into Dropbox
In Excel, open the master workbook and go to the
"GB Camp 2026 Consent Form" tab (the raw response data).
File → Save a Copy → CSV (Comma delimited). Call it e.g.
`camp2026-data.csv`.
Upload that CSV to Dropbox.
Right-click the file in Dropbox → Share → Copy link.
Make sure the sharing setting is "People with the link", not public
search — this file has children's medical and contact details in it.
Paste that link into the app's Sync tab, tap Save & sync now.
Part 3 — Install it as an app on a phone
iPhone: open the GitHub Pages URL in Safari → tap Share → Add to
Home Screen.
Android: open the URL in Chrome → tap the menu (⋮) → Install app
(or "Add to Home screen").
It now has an icon like any other app, opens full-screen, and works
offline once synced.
Updating the data later
Whenever the form responses change: re-export the same tab to CSV,
re-upload it to the same Dropbox file (overwrite it, don't create a
new share link), and on each phone open the app's Sync tab and tap
Sync now (or just open the app with signal — it syncs automatically
in the background).
Notes
The app never phones home to any Anthropic/Claude/other server — it only
talks to your Dropbox link.
Data lives in the phone's local storage. Uninstalling the app / clearing
site data removes it from that phone.
Because this file contains medical and safeguarding information, keep
the Dropbox link private and only share it with leaders who need it.
