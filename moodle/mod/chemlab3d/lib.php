<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

/**
 * Features supported by the ChemLab 3D activity.
 *
 * @param string $feature Feature constant.
 * @return bool|null Whether the feature is supported.
 */
function chemlab3d_supports($feature) {
    switch ($feature) {
        case FEATURE_MOD_INTRO:
            return true;
        case FEATURE_SHOW_DESCRIPTION:
            return true;
        case FEATURE_COMPLETION_TRACKS_VIEWS:
            return true;
        case FEATURE_BACKUP_MOODLE2:
            return true;
        default:
            return null;
    }
}

/**
 * Get the list of practicals which can be assigned to a Moodle activity.
 *
 * @return array Practical ID => translated label.
 */
function chemlab3d_task_options() {
    $ids = [
        'free', 'h2', 'o2', 'co2', 'neu', 'cuoh2', 'amph', 'golden', 'fescn', 'anions',
        'fecu', 'flame', 'mgo', 'nh3cu', 'kmno4', 'mirror', 'subl', 'volcano', 'acetylene',
        'cohydrolysis', 'chameleon', 'prussian', 'goldenrain', 'phenol_test', 'esterification',
        'electrolysis_ki', 'conductivity_cuso4', 'burette_titration', 'separation_lab',
        'muffle_calcination', 'hotplate_cuo_synthesis', 'quantum_dots_cdse', 'phosphor_znscu',
        'luminol_two_flasks',
    ];

    $options = [];
    foreach ($ids as $id) {
        $options[$id] = get_string('task_' . $id, 'mod_chemlab3d');
    }
    return $options;
}

/**
 * Add a ChemLab 3D activity instance.
 *
 * @param stdClass $data Form data.
 * @param moodleform_mod $mform Activity form.
 * @return int New instance ID.
 */
function chemlab3d_add_instance($data, $mform = null) {
    global $DB;

    $data->timecreated = time();
    $data->timemodified = $data->timecreated;
    $taskoptions = chemlab3d_task_options();
    if (!isset($taskoptions[$data->taskid ?? ''])) {
        $data->taskid = 'free';
    }
    $data->preparetask = empty($data->preparetask) ? 0 : 1;
    return $DB->insert_record('chemlab3d', $data);
}

/**
 * Update a ChemLab 3D activity instance.
 *
 * @param stdClass $data Form data.
 * @param moodleform_mod $mform Activity form.
 * @return bool True on success.
 */
function chemlab3d_update_instance($data, $mform = null) {
    global $DB;

    $data->id = $data->instance;
    $data->timemodified = time();
    $taskoptions = chemlab3d_task_options();
    if (!isset($taskoptions[$data->taskid ?? ''])) {
        $data->taskid = 'free';
    }
    $data->preparetask = empty($data->preparetask) ? 0 : 1;
    return $DB->update_record('chemlab3d', $data);
}

/**
 * Delete a ChemLab 3D activity instance.
 *
 * @param int $id Instance ID.
 * @return bool True when deleted, false if it did not exist.
 */
function chemlab3d_delete_instance($id) {
    global $DB;

    if (!$DB->record_exists('chemlab3d', ['id' => $id])) {
        return false;
    }
    $DB->delete_records('chemlab3d', ['id' => $id]);
    return true;
}

/**
 * Provide cached information for the course page.
 *
 * @param stdClass $coursemodule Course-module record.
 * @return cached_cm_info|false
 */
function chemlab3d_get_coursemodule_info($coursemodule) {
    global $DB;

    $instance = $DB->get_record('chemlab3d', ['id' => $coursemodule->instance]);
    if (!$instance) {
        return false;
    }

    $info = new cached_cm_info();
    $info->name = $instance->name;
    if (!empty($coursemodule->showdescription)) {
        $info->content = format_module_intro('chemlab3d', $instance, $coursemodule->id, false);
    }
    return $info;
}

/**
 * Serve the bundled, same-origin laboratory app to an authenticated course user.
 *
 * The file area is deliberately read-only and resolves only to files inside app/.
 * PHP files and unknown file types are never served.
 *
 * @param stdClass $course Course record.
 * @param stdClass $cm Course-module record.
 * @param context_module $context Module context.
 * @param string $filearea File area.
 * @param array $args Remaining URL path components (starts with item ID).
 * @param bool $forcedownload Whether to force download.
 * @param array $options Extra file options.
 * @return bool Does not return when a file is served.
 */
function chemlab3d_pluginfile($course, $cm, $context, $filearea, $args, $forcedownload, array $options = []) {
    if ($context->contextlevel !== CONTEXT_MODULE || $filearea !== 'app' || empty($args)) {
        return false;
    }

    require_login($course, true, $cm);
    require_capability('mod/chemlab3d:view', $context);

    // The first path component is the Moodle file-area item ID. This static bundle uses 0.
    $itemid = array_shift($args);
    if ((string)$itemid !== '0' || empty($args)) {
        return false;
    }

    $segments = [];
    foreach ($args as $segment) {
        $segment = rawurldecode((string)$segment);
        if ($segment === '' || $segment === '.' || $segment === '..' || strpos($segment, '/') !== false || strpos($segment, '\\') !== false) {
            return false;
        }
        $segments[] = $segment;
    }
    $relativepath = implode(DIRECTORY_SEPARATOR, $segments);

    $mimetypes = [
        'html' => 'text/html; charset=utf-8',
        'css' => 'text/css; charset=utf-8',
        'js' => 'application/javascript; charset=utf-8',
        'mjs' => 'application/javascript; charset=utf-8',
        'json' => 'application/json; charset=utf-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'otf' => 'font/otf',
    ];
    $extension = strtolower(pathinfo($relativepath, PATHINFO_EXTENSION));
    if (!isset($mimetypes[$extension])) {
        return false;
    }

    $basepath = realpath(__DIR__ . DIRECTORY_SEPARATOR . 'app');
    $filepath = $basepath ? realpath($basepath . DIRECTORY_SEPARATOR . $relativepath) : false;
    if (!$basepath || !$filepath || !is_file($filepath) || strpos($filepath, $basepath . DIRECTORY_SEPARATOR) !== 0) {
        return false;
    }

    send_file($filepath, basename($relativepath), 0, 0, false, $forcedownload, $mimetypes[$extension]);
}
