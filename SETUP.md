# Planner — setup (about 15 minutes, once)

## 1. Put the app on your own website (GitHub Pages)
1. On github.com, create a new **public** repository named `planner` (leave it empty).
2. Upload every file in this folder (keep the `icons` folder).
3. Repository → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
4. After a minute your app is live at `https://<your-username>.github.io/planner/`.

## 2. Add it to your iPhone
1. Open that link in **Safari** on your iPhone 16 Pro.
2. Share button → **Add to Home Screen** → Add.
3. Open it from the Home Screen icon. It now runs full screen, works offline and opens instantly.

## 3. Back it up to a Google Sheet (and get Drive reports and Calendar)
1. Go to https://script.google.com → **New project** → paste all of `backend/Code.gs`.
2. Change `SECRET` at the top to your own word.
3. **Deploy → New deployment → Web app** → Execute as: *Me* → Who has access: *Anyone* → Deploy → allow the permissions.
4. Copy the link ending in `/exec`.
5. In the app: **Rules → Google Sheet sync** → paste the link and your secret word → **Test and save now**.

A folder named **Planner** appears in your Drive with the data sheet, a backup file, and (every Sunday) the week report PDF. Placed blocks appear in a **Planner** calendar.

## 4. Back tap twice → Quick capture
1. **Shortcuts** app → **+** → name it **Quick Capture**.
2. Add **Dictate Text** (or **Ask for Input** if you prefer typing).
3. Add **Get Contents of URL**: your `/exec` link · Method **POST** · Request Body **JSON** with three text fields: `op` = `capture`, `key` = your secret word, `text` = *Dictated Text*.
4. Add **Show Notification** → "Captured".
5. iPhone **Settings → Accessibility → Touch → Back Tap → Double Tap → Quick Capture**.

Double-tap the back of the phone, speak, done. The note waits in **Decide**.

## 5. Brahma Muhurta alarm (only on days you choose)
1. New shortcut named exactly **Brahma Alarm**.
2. Add **Get Dates from Input** (input: *Shortcut Input*) → **Create Alarm** at that time, label "Brahma Muhurta".
3. In the app, tap **Set alarm for tomorrow** on Today or in the Shutdown. A real Clock alarm is set 10 minutes before Brahma Muhurta.

## Updating the app later
Replace the files on GitHub. Change `VERSION` in `sw.js` so phones pick up the new version.
