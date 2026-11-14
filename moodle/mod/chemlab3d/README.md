# Moodle activity module: ХимЛаб 3D

A self-contained Moodle **activity module** (`mod_chemlab3d`) that launches ХимЛаб 3D 2.3.0 inside a course page. The bundled app and Three.js are served from this Moodle instance; no external CDN, Node.js, or `npm install` is needed on the Moodle server.

## System requirements / Системные требования

### Moodle server

- **Moodle 4.1 or later**. `version.php` declares Moodle 4.1 as the plugin API minimum. For a public production site, use a Moodle release that is still receiving security fixes.
- The server must meet the core PHP, database, and operating-system requirements of the exact Moodle release you install. This plugin uses Moodle's database and file APIs and adds **no PHP extensions or third-party server packages**. For example, Moodle 5.2's published requirements include 64-bit PHP 8.3+, the Sodium extension, `max_input_vars >= 5000`, and a supported database such as PostgreSQL 16+, MySQL 8.4+, MariaDB 10.11+, or MS SQL Server 2019+. Check Moodle's [official 5.2 requirements](https://moodledev.io/general/releases/5.2) or the requirements page for your chosen Moodle version before installation; Moodle's **Site administration → Server → Environment** check is authoritative for that site.
- **No Node.js, npm, build step, or external CDN access is required** on the Moodle server. The packaged app assets occupy about 1.3 MB uncompressed and are served from the same authenticated Moodle site using `pluginfile.php`.
- Use **HTTPS** in production. Students' browsers must be able to load the Moodle activity and its same-origin plugin files.

### Student computer or tablet

- A current desktop browser with **JavaScript ES modules and WebGL 2** enabled, such as current Chrome, Edge, Firefox, or Safari. WebGL 2 and GPU acceleration are required for the 3D laboratory; browsers with acceleration disabled may render slowly or fail to start the 3D scene.
- An integrated or discrete GPU supported by the browser. Rendering is done on each learner's device, **not on the Moodle server**.
- There is no fixed RAM/CPU minimum published for the activity. As a practical classroom recommendation, use a reasonably recent multi-core computer with **8 GB RAM** and a screen around **1280 × 800** or larger. Tablets may work, but a laptop or desktop is recommended for the full interface.
- Browser local storage should be allowed if the learner wants the simulator's progress badges to persist on that device. The rest of the activity can still be used if local storage is blocked, but those local badges may not be saved.

## Install

### Install from the Moodle plugin ZIP

1. Download `mod_chemlab3d.zip` from the repository's `feature/moodle-chemlab3d` branch (or build it with `moodle/build-plugin.sh`).
2. In Moodle, open **Site administration → Plugins → Install plugins**, upload the ZIP, and follow the upgrade prompts.
3. Alternatively, extract the archive so the plugin directory is `<moodle-root>/mod/chemlab3d/`, then run Moodle's normal upgrade page or:
   ```bash
   php admin/cli/upgrade.php --non-interactive
   ```
4. Purge Moodle caches if the new activity does not immediately appear.

### Install from a Git checkout

Copy `moodle/mod/chemlab3d/` from this repository into `<moodle-root>/mod/chemlab3d/`, then complete the Moodle upgrade as above.

## Use in a course

1. Turn editing on and add the **ХимЛаб 3D** activity.
2. Enter an activity name, select a practical (free experiment or tasks 01–33), and optionally enable **Prepare the initial setup automatically**.
3. Save. The student opens the selected task in the embedded 3D laboratory. Moodle's standard **View the activity** completion condition is supported.

The Moodle activity itself is a launcher, not a gradebook assessment: the simulator checks practical steps in the browser, but this release does not upload grades, saved experiments, reports, or completion badges to Moodle. The app's local completion badges are stored in browser `localStorage`, in a namespace scoped to the current Moodle user and activity so shared classroom browsers do not mix progress. They are not tamper-proof and should not be used as high-stakes assessment evidence.

## Security and privacy notes

- App files are served through Moodle's authenticated `pluginfile.php` route and require `mod/chemlab3d:view`.
- Only the bundled static app file types are served; PHP files and path traversal are rejected.
- The iframe and ES module imports stay on the Moodle origin. There are no third-party CDN requests.
- No learner profile or experiment data is stored by this plugin on the Moodle server.

## Updating the bundled app

After changing the root application, copy `index.html`, `src/*.js`, `styles/lab.css`, and `vendor/three.module.min.js` into the corresponding `app/` locations inside this plugin, then rebuild the ZIP. The current bundled release is ХимЛаб 3D 2.3.0.

## License

The Moodle integration code is GPL-3.0-or-later. The bundled application is MIT-licensed, and the included Three.js distribution is MIT-licensed by the Three.js Authors.
