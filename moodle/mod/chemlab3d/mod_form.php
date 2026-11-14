<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/course/moodleform_mod.php');
require_once(__DIR__ . '/lib.php');

/** Moodle settings form for the ChemLab 3D activity. */
class mod_chemlab3d_mod_form extends moodleform_mod {

    /** Define the activity settings. */
    public function definition() {
        $mform = $this->_form;

        $mform->addElement('text', 'name', get_string('name'), ['size' => 64]);
        $mform->setType('name', PARAM_TEXT);
        $mform->addRule('name', null, 'required', null, 'client');

        $this->standard_intro_elements();

        $mform->addElement('select', 'taskid', get_string('selectedtask', 'mod_chemlab3d'), chemlab3d_task_options());
        $mform->addHelpButton('taskid', 'selectedtask', 'mod_chemlab3d');
        $mform->setDefault('taskid', 'free');
        $mform->setType('taskid', PARAM_ALPHANUMEXT);

        $mform->addElement('advcheckbox', 'preparetask', get_string('preparetask', 'mod_chemlab3d'),
            get_string('preparetask_help', 'mod_chemlab3d'));
        $mform->setDefault('preparetask', 1);
        $mform->setType('preparetask', PARAM_INT);

        $this->standard_coursemodule_elements();
        $this->add_action_buttons();
    }

    /**
     * Validate the activity settings.
     *
     * @param array $data Submitted form values.
     * @param array $files Submitted files.
     * @return array Validation errors.
     */
    public function validation($data, $files) {
        $errors = parent::validation($data, $files);
        $taskoptions = chemlab3d_task_options();
        if (!isset($taskoptions[$data['taskid'] ?? ''])) {
            $errors['taskid'] = get_string('choose_task', 'mod_chemlab3d');
        }
        return $errors;
    }
}
