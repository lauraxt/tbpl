<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

interface FileGenerator {
  public function generate($filename);
}

class ParallelFileGenerating {

  /**
   * Ensures that a file exists. If the file doesn't exist yet,
   * $generator->generate($filename) is called so that it will
   * exist afterwards.
   * If the same file is requested simultaneously by multiple
   * PHP scripts executing in parallel, the generator will only
   * be executed once, and all waiting scripts will use the same
   * generated file afterwards.
   * Synchronization happens with the help of a lock file.
   */
  static public function ensureFileExists($filename, FileGenerator $generator) {
    self::ensureDirectoryStructureIsInPlaceForFile($filename);
    $lockFilename = $filename.".lock";
    $lockFile = fopen($lockFilename, "w");
    $exception = null;

    // If the lock file is not locked, this flock call will succeed
    // instantly and return true.
    // If the lock file is already locked (because the file is being
    // generated simultaneously for somebody else), the flock call
    // will block until the lock is lifted. Then it will return true.
    // The documentation is unclear about the cases when it returns
    // false.
    if (flock($lockFile, LOCK_EX)) {
      if (!file_exists($filename)) {
        try {
          $generator->generate($filename);
          if (file_exists($filename))
            chmod($filename, 0777);
          else
            $exception = new Exception("File {$filename} still doesn't exist!");
        } catch (Exception $e) {
          $exception = $e;
        }
      }
      flock($lockFile, LOCK_UN);
      fclose($lockFile);
      @unlink($lockFilename);
    } else {
      fclose($lockFile);
    }
    if ($exception)
      throw $exception;
  }

  static protected function ensureDirectoryStructureIsInPlaceForFile($filename) {
    $dir = dirname($filename);
    if (!is_dir($dir)) {
      $oldumask = umask(0);
      mkdir($dir, 0777, true);
      umask($oldumask);
    }
  }
}
