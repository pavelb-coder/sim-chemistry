<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/chemlab3d/backup/moodle2/restore_chemlab3d_stepslib.php');

/** Restore task for the ChemLab 3D activity. */
class restore_chemlab3d_activity_task extends restore_activity_task {

    /** This activity has no extra restore settings. */
    protected function define_my_settings() {
    }

    /** Add the activity structure step. */
    protected function define_my_steps() {
        $this->add_step(new restore_chemlab3d_activity_structure_step('chemlab3d_structure', 'chemlab3d.xml'));
    }

    /** There are no plugin file areas containing encoded course links. */
    public static function define_decode_contents() {
        return [];
    }

    /** There are no plugin URL patterns to decode. */
    public static function define_decode_rules() {
        return [];
    }
}
