<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

require_once($CFG->dirroot . '/mod/chemlab3d/backup/moodle2/backup_chemlab3d_stepslib.php');

/** Backup task for the ChemLab 3D activity. */
class backup_chemlab3d_activity_task extends backup_activity_task {

    /** This activity has no extra backup settings. */
    protected function define_my_settings() {
    }

    /** Add the activity structure step. */
    protected function define_my_steps() {
        $this->add_step(new backup_chemlab3d_activity_structure_step('chemlab3d_structure', 'chemlab3d.xml'));
    }

    /** This activity has no embedded content links that need conversion. */
    public static function encode_content_links($content) {
        return $content;
    }
}
