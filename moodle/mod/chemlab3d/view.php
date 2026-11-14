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
$cm = get_coursemodule_from_id('chemlab3d', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$instance = $DB->get_record('chemlab3d', ['id' => $cm->instance], '*', MUST_EXIST);

require_login($course, true, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/chemlab3d:view', $context);

$PAGE->set_url('/mod/chemlab3d/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($instance->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->set_pagelayout('incourse');
$PAGE->requires->css(new moodle_url('/mod/chemlab3d/styles/moodle.css'));

$event = \core\event\course_module_viewed::create([
    'objectid' => $cm->id,
    'context' => $context,
]);
$event->add_record_snapshot('course', $course);
$event->trigger();

$completion = new completion_info($course);
$completion->set_module_viewed($cm);

// Each learner/activity pair gets its own localStorage namespace, including on shared devices.
$storagescope = hash('sha256', $USER->id . ':' . $cm->id . ':' . $CFG->siteidentifier);
$iframeurl = moodle_url::make_pluginfile_url(
    $context->id,
    'mod_chemlab3d',
    'app',
    0,
    '/',
    'index.html',
    false
);
$iframeurl->param('task', $instance->taskid);
$iframeurl->param('moodle', '1');
$iframeurl->param('storage', $storagescope);
if ($instance->taskid !== 'free' && !empty($instance->preparetask)) {
    $iframeurl->param('prep', '1');
}

$taskoptions = chemlab3d_task_options();
$tasklabel = $taskoptions[$instance->taskid] ?? $taskoptions['free'];

echo $OUTPUT->header();
echo $OUTPUT->heading(format_string($instance->name));
if (!empty($instance->intro)) {
    echo format_module_intro('chemlab3d', $instance, $cm->id, false);
}
echo $OUTPUT->notification(get_string('selectedtask', 'mod_chemlab3d') . ': ' . $tasklabel,
    'info', false);
echo html_writer::tag('p', get_string('pluginintro', 'mod_chemlab3d'), ['class' => 'text-muted']);

echo html_writer::start_div('chemlab3d-launch');
echo html_writer::tag('iframe', '', [
    'id' => 'chemlab3d-frame',
    'class' => 'chemlab3d-frame',
    'src' => $iframeurl->out(false),
    'title' => get_string('labframe_title', 'mod_chemlab3d'),
    'allow' => 'fullscreen; autoplay',
    'allowfullscreen' => 'allowfullscreen',
    'loading' => 'eager',
    'referrerpolicy' => 'same-origin',
]);
echo html_writer::end_div();
echo $OUTPUT->footer();
