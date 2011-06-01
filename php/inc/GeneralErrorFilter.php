<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

/**
 * This class is used for finding errors in logs. It's used when generating
 * parsed logs with summaries at the top, and for the "general error" summary
 * that's displayed in a blue box on TBPL.
 */

require_once 'inc/LineFilter.php';

class GeneralErrorFilter implements LineFilter {

  public function getType() {
    return "general_error";
  }

  public function matchLine($line) {
    // Copied from
    // http://bonsai.mozilla.org/cvsblame.cgi?file=mozilla/webtools/tinderbox/ep_unittest.pl&rev=1.7#28
    // minus CVS errors
    return
     (preg_match("/fatal error/", $line)  // . . . . . . . . . . . . . . . . . Link
       || preg_match("/^g?make(?:\[\d\d?\])?: \*\*\*/", $line) //. . . . . . . gmake
       || preg_match("/Automation Error\:/", $line) // . . . . . . . . . . . . Release Automation
       || preg_match("/ error\([0-9]*\)\:/", $line) // . . . . . . . . . . . . C
       || preg_match("/TEST-UNEXPECTED-(?:PASS|FAIL) /", $line) // . . . . . . new unified error output
       || preg_match("/buildbot\.slave\.commands\.TimeoutError:/", $line) // . buildbot error
       || preg_match("/PROCESS-CRASH/", $line)  // . . . . . . . . . . . . . . crash
       || preg_match("/^Thread \d+ \(crashed\)$/", $line) // . . . . . . . . . stack-walking info
       ) && !preg_match("/TEST-INFO /", $line); // . . . . . . . . . . . . . . information line
  }
}
