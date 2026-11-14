<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

defined('MOODLE_INTERNAL') || die();

/** Backup structure for a ChemLab 3D activity. */
class backup_chemlab3d_activity_structure_step extends backup_activity_structure_step {

    /** Define the data to be included in a course backup. */
    protected function define_structure() {
        $chemlab3d = new backup_nested_element('chemlab3d', ['id'], [
            'course',
            'name',
            'intro',
            'introformat',
            'taskid',
            'preparetask',
            'timecreated',
            'timemodified',
        ]);

        return $this->prepare_activity_structure($chemlab3d);
    }
}
