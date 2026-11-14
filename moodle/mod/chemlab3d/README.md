# Moodle activity module: ХимЛаб 3D

A self-contained Moodle **activity module** (`mod_chemlab3d`) that launches ХимЛаб 3D 2.3.0 inside a course page. The bundled app and Three.js are served from this Moodle instance; no external CDN, Node.js, or `npm install` is needed on the Moodle server.

## Requirements

- Moodle **4.1 or later**.
- A modern student browser with WebGL enabled.
- HTTPS is recommended for production Moodle installations.

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
