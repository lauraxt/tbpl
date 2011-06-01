<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

require_once 'inc/LogParser.php';
require_once 'inc/GeneralErrorFilter.php';
require_once 'inc/ReftestFailureFilter.php';
require_once 'inc/TinderboxPrintFilter.php';
require_once 'inc/AnnotatedSummaryGenerator.php';
require_once 'inc/GzipUtils.php';
require_once 'inc/RunForLog.php';

header("Access-Control-Allow-Origin: *");

$type = isset($_GET["type"]) ? $_GET["type"] : "plaintext";

$run = getRequestedRun();

try {
  if ($type == "reftest") {
    $logParser = new LogParser($run, new ReftestFailureFilter());
    $reftestExcerptFilename = $logParser->ensureExcerptExists();
    GzipUtils::passThru($reftestExcerptFilename, 'text/plain');
  } else if ($type == "tinderbox_print") {
    $logParser = new LogParser($run, new TinderboxPrintFilter());
    $tinderboxPrintExcerptFilename = $logParser->ensureExcerptExists();
    GzipUtils::passThru($tinderboxPrintExcerptFilename, 'text/plain');
  } else {
    $logParser = new LogParser($run, new GeneralErrorFilter());
    $rawErrorSummaryFilename = $logParser->ensureExcerptExists();
    if ($type != "annotated") {
      GzipUtils::passThru($rawErrorSummaryFilename, 'text/plain');
    } else {
      date_default_timezone_set('America/Los_Angeles');
      $logDescription = $run['buildername'].' on '.date("Y-m-d H:i:s", $run['starttime']);
      $annotatedSummaryGenerator = new AnnotatedSummaryGenerator($rawErrorSummaryFilename, $logDescription);
      $annotatedSummaryFilename = $annotatedSummaryGenerator->ensureAnnotatedSummaryExists();
      GzipUtils::passThru($annotatedSummaryFilename, 'text/plain');
    }
  }
} catch (Exception $e) {
  die("Log not available.");
}
