<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT);
$course = $DB->get_record('course', ['id' => $id], '*', MUST_EXIST);
require_course_login($course);

$PAGE->set_url('/mod/chemlab3d/index.php', ['id' => $course->id]);
$PAGE->set_title(get_string('modulenameplural', 'mod_chemlab3d'));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_pagelayout('incourse');

$instances = $DB->get_records('chemlab3d', ['course' => $course->id], 'name ASC');
echo $OUTPUT->header();
echo $OUTPUT->heading(get_string('modulenameplural', 'mod_chemlab3d'));

if (!$instances) {
    echo $OUTPUT->notification(get_string('nothingtodisplay'), 'info');
} else {
    $table = new html_table();
    $table->head = [get_string('name'), get_string('selectedtask', 'mod_chemlab3d')];
    $table->data = [];
    foreach ($instances as $instance) {
        $cm = get_coursemodule_from_instance('chemlab3d', $instance->id, $course->id, false, IGNORE_MISSING);
        if (!$cm || !has_capability('mod/chemlab3d:view', context_module::instance($cm->id))) {
            continue;
        }
        $url = new moodle_url('/mod/chemlab3d/view.php', ['id' => $cm->id]);
        $taskoptions = chemlab3d_task_options();
        $table->data[] = [
            html_writer::link($url, format_string($instance->name)),
            s($taskoptions[$instance->taskid] ?? $taskoptions['free']),
        ];
    }
    echo html_writer::table($table);
}

echo $OUTPUT->footer();
