<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

/**
 * This LineFilter only matches lines that are useful to the reftest analyzer.
 * In contrast to the GeneralErrorFilter, it also includes reftest images.
 */

require_once 'inc/LineFilter.php';

class ReftestFailureFilter implements LineFilter {

  public function getType() {
    return "reftest";
  }

  public function matchLine($line) {
    return !!preg_match("/(REFTEST (?:TEST-UNEXPECTED| *IMAGE|number of).*)/", $line);
  }
}
