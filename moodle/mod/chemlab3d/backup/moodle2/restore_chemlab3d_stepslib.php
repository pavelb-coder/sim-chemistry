<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

/** Restore structure for a ChemLab 3D activity. */
class restore_chemlab3d_activity_structure_step extends restore_activity_structure_step {

    /** Define the backup paths to restore. */
    protected function define_structure() {
        return [new restore_path_element('chemlab3d', '/activity/chemlab3d')];
    }

    /** Restore one activity record. */
    protected function process_chemlab3d($data) {
        global $DB;

        $data = (object)$data;
        $data->course = $this->get_courseid();
        $newitemid = $DB->insert_record('chemlab3d', $data);
        $this->apply_activity_instance($newitemid);
    }

    /** Restore the activity introduction files. */
    protected function after_execute() {
        $this->add_related_files('mod_chemlab3d', 'intro', null);
    }
}
