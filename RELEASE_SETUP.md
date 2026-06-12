# Kairos — Android Release Setup (do these in order)

This is your personal to-do checklist. The CI/code changes are already done and
pushed. Follow the steps top-to-bottom whenever you're ready. You can stop after
any step and come back later.

---

## Step 0 — Test the app yourself (do this first)

Before bothering with signing keys and the Play Store, just make sure the build
works and you're happy with it.

- **Web/dev:** `npm run dev`
- **Mobile (on a connected Android phone or emulator):**
  ```bash
  npm run build:mobile
  npx cap run android
  ```
- Or grab the APK that CI just built (see below) and sideload it.

### Where to find the APK CI builds for you

After you push a tag, GitHub Actions builds an APK and attaches it to the
release.

1. Go to your repo → **Actions** tab → wait for the **Release** workflow to finish.
2. Go to the repo **Releases** page (right sidebar) → open the **draft** release
   for the tag.
3. Download `Kairos-v0.0.4.apk`.
4. Copy it to your phone and tap it to install (you may need to allow
   "Install unknown apps" for your file manager/browser).

> Until you add the signing secrets (Step 2–3), CI ships a **debug-signed** APK.
> It installs and runs fine for testing/sideloading — it just can't be uploaded
> to the Play Store. That's expected and totally OK for now.

---

## Step 1 — Generate your signing key (one time, keep it forever)

A signing key is a permanent file that proves updates come from you. Android
refuses to update an app signed by a different key. **If you lose this file you
can never update the app again — back it up.**

Run on your computer (Java is already installed):

```bash
keytool -genkeypair -v \
  -keystore kairos-release.keystore \
  -alias kairos \
  -keyalg RSA -keysize 2048 -validity 10000
```

- It asks you to **set a password** → write it down (this is your "keystore password").
- Name/org questions → any answer is fine ("Unknown" is OK).
- If it asks for a separate "key password" → just press **Enter** to reuse the
  keystore password (the CI assumes this).

This creates `kairos-release.keystore`. **Back it up** (password manager /
encrypted drive). **Do NOT commit it to git** — it's secret.

---

## Step 2 — Encode the keystore as text

GitHub secrets only hold text, so convert the file to base64:

```bash
base64 -w0 kairos-release.keystore > keystore.b64
```

`keystore.b64` is now one long line of text you'll paste in the next step.

---

## Step 3 — Add 4 secrets on GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add all four:

| Secret name                  | What to paste                                  |
|------------------------------|------------------------------------------------|
| `ANDROID_KEYSTORE_BASE64`    | the entire contents of `keystore.b64`          |
| `ANDROID_KEYSTORE_PASSWORD`  | the password you set in Step 1                 |
| `ANDROID_KEY_ALIAS`          | `kairos`                                        |
| `ANDROID_KEY_PASSWORD`       | same password (since you pressed Enter)        |

Once these exist, the next tag you push builds a **signed** APK **and** an AAB.

---

## Step 4 — Re-build to get the signed APK + AAB

Push a fresh tag (or re-move an existing one) so CI rebuilds with the secrets:

```bash
# Example for a new version:
git tag v0.0.5
git push origin v0.0.5
```

CI attaches two files to the release:
- `Kairos-v0.0.5.apk`  → sideload / direct download
- `Kairos-v0.0.5.aab`  → upload to Play Store (Step 5)

> If the **AAB** part fails for any reason, don't worry — the APK still gets
> built and attached. You can sort the AAB out later.

---

## Step 5 — Play Console (the store side, do whenever ready)

1. [play.google.com/console](https://play.google.com/console) → pay the one-time
   **$25** developer fee → create your developer account.
2. **Create app** → name (Kairos), language, "App", free/paid.
3. Complete Google's left-side checklist: privacy policy URL, content rating,
   target audience, data safety form, store listing (description, screenshots,
   icon, feature graphic). Tedious but all forms.
4. **Release → Production → Create new release.**
5. Keep **Play App Signing ON** (default/recommended). Google holds the final
   key; your keystore becomes just the "upload key" — so even if you lose it,
   Google can help you reset it.
6. **Upload the `.aab`** (download `Kairos-vX.Y.Z.aab` from your GitHub release).
   Play only accepts AABs, not APKs.
7. Add release notes → **Review** → **Roll out**. First submission goes through
   Google review (hours to a few days).

For every future version: push a new tag → download the new `.aab` → upload as a
new Play release. The `versionCode` auto-increments from the tag, so Play accepts
it.

---

## How versioning works now (FYI, nothing to do)

- You no longer hand-edit `versionCode`/`versionName` in `android/app/build.gradle`.
- They are derived from the git tag in CI:
  - Tag `v0.1.5` → `versionName = 0.1.5`
  - `versionCode = MAJOR*1000000 + MINOR*1000 + PATCH` → `0*1000000 + 1*1000 + 5 = 1005`
- Each new tag produces a higher `versionCode` (Play requires this), as long as
  minor/patch stay under 1000.
- **Release flow:** bump `"version"` in `package.json` → `git tag vX.Y.Z` →
  `git push origin vX.Y.Z`. Done.
