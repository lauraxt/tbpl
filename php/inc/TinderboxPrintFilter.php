<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

/**
 * This LineFilter extracts those parts of the log that used to be dumped
 * into the table cells on Tinderbox. Those parts are called "scrape" and are
 * used by TBPL in the right part of the panel at the bottom that shows test
 * results, e.g. "mochitest-plain-5: 7341/178/54"
 */

require_once 'inc/LineFilter.php';

class TinderboxPrintFilter implements LineFilter {

  public function getType() {
    return "tinderbox_print";
  }

  public function matchLine($line) {
    if (!preg_match("/^TinderboxPrint:(.*)$/", $line, $matches))
      return false;
    return $matches[1]."\n";
  }
}
