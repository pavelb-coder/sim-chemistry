<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

namespace mod_chemlab3d\privacy;

defined('MOODLE_INTERNAL') || die();

use core_privacy\local\metadata\null_provider;

/**
 * Privacy declaration: this plugin does not store learner data on the Moodle server.
 * The app's simple completion badges are kept in the learner's browser localStorage.
 */
class provider implements null_provider {

    /**
     * Explain why the plugin has no Moodle-side personal data to export or erase.
     *
     * @return string Privacy language string identifier.
     */
    public static function get_reason(): string {
        return 'privacy:metadata';
    }
}
