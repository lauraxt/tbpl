<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

/**
 * This class provides shared code for ShortLogGenerator and FullLogGenerator.
 */

require_once 'inc/LogParser.php';
require_once 'inc/ParallelFileGenerating.php';

abstract class ParsedLogGenerator implements FileGenerator {

  // e.g. "short" or "full"
  abstract protected function getType();

  public function ensureLogExists() {
    $parsedLogFilename = "../cache/parsedlog/".$this->runID."_".$this->getType().".html.gz";
    ParallelFileGenerating::ensureFileExists($parsedLogFilename, $this);
    return $parsedLogFilename;
  }

  public function __construct(LogParser $logParser, $run) {
    $this->logParser = $logParser;
    $this->runID = $run['_id'];
    $this->machineType = $run['buildername'];
    $this->revision = $run['revision'];
    $this->endTime = $run['endtime'];
    $this->startTime = $run['starttime'];
    $this->logURL = $run['log'];
    $this->branch = $run['branch'];
  }

  public function generate($filename) {
    $summary = $this->logParser->getExcerpt(true);
    $log = $this->getLog();
    $result = $this->generateHTML($summary, $log);
    GzipUtils::writeToFile($filename, $result);
  }

  abstract protected function getLog();

  abstract protected function generateHTML($summary, $log);
}
