<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

/**
 * This class downloads gzipped log files from ftp.mozilla.org.
 */

require_once 'inc/ParallelFileGenerating.php';
require_once 'inc/GzipUtils.php';

class RawGzLogDownloader implements FileGenerator {

  public function __construct($logURL) {
    $this->logURL = $logURL;
  }

  public function generate($filename) {
    $host = "ftp.mozilla.org";
    $hostpos = strpos($this->logURL, $host);
    if ($hostpos === false)
      throw new Exception("Log file {$this->logURL} not hosted on {$host}!");
    $path = substr($this->logURL, $hostpos + strlen($host) + strlen("/"));
    $ftpstream = @ftp_connect($host);
    if (!@ftp_login($ftpstream, "anonymous", ""))
      throw new Exception("Couldn't connect to Mozilla FTP server.");
    if (!@ftp_get($ftpstream, $filename, $path, FTP_BINARY))
      throw new Exception("Log not available at URL {$this->logURL}.");
    ftp_close($ftpstream);
  }

  public static function getLines($run) {
    $rawLogFilename = "../cache/rawlog/".$run['_id'].".txt.gz";
    ParallelFileGenerating::ensureFileExists($rawLogFilename, new self($run['log']));
    return GzipUtils::getLines($rawLogFilename);
  }
}
