<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

require_once 'inc/ParallelFileGenerating.php';
require_once 'inc/GzipUtils.php';
require_once 'inc/RawGzLogDownloader.php';
require_once 'inc/LineFilter.php';

class LogParser implements FileGenerator {
  private $lines = null;
  private $filteredLines = null;

  public function __construct($run, LineFilter $lineFilter) {
    $this->run = $run;
    $this->lineFilter = $lineFilter;
  }

  public function ensureExcerptExists() {
    $excerptFilename = "../cache/excerpt/".$this->run['_id']."_".$this->lineFilter->getType().".txt.gz";
    ParallelFileGenerating::ensureFileExists($excerptFilename, $this);
    return $excerptFilename;
  }

  // Called during ensureExcerptExists, FileGenerator implementation
  public function generate($filename) {
    GzipUtils::writeToFile($filename, $this->getExcerpt());
  }

  protected function linkLine($target, $text) {
    if (substr($text, -1) == "\n")
      $text = substr($text, 0, -1);
    if (substr($text, -1) == "\r")
      $text = substr($text, 0, -1);
    return '<a href="'.$target.'">'.htmlspecialchars($text)."</a>\n";
  }

  public function getExcerpt($asHTML = false) {
    $lines = $this->getLines();
    $filteredLines = $this->getFilteredLines();
    $excerptLines = array();
    foreach ($filteredLines as $i => $lineNumber) {
      $lineMatch = $this->lineFilter->matchLine($lines[$lineNumber]);
      if ($lineMatch === true)
        $lineMatch = $lines[$lineNumber];
      $excerptLines[] = $asHTML ? $this->linkLine('#error'.$i, $lineMatch) : $lineMatch;
    }
    return implode('', $excerptLines);
  }

  public function getLines() {
    if (!$this->lines) {
      $this->lines = RawGzLogDownloader::getLines($this->run);
    }
    return $this->lines;
  }

  public function getFilteredLines() {
    if (!$this->filteredLines) {
      $this->filteredLines = $this->findFilteredLines();
    }
    return $this->filteredLines;
  }

  public function findFilteredLines() {
    $lines = $this->getLines();
    $filteredLines = array();
    foreach ($lines as $i => $line) {
      if ($this->lineFilter->matchLine($line)) {
        $filteredLines[] = $i;
      }
    }
    return $filteredLines;
  }
}
