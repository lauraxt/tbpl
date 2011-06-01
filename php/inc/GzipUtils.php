<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

class GzipUtils {

  public static function writeToFile($filename, $content) {
    $fp = gzopen($filename, "w9");
    gzwrite($fp, $content);
    gzclose($fp);
  }

  public static function passThru($filename, $mimeType) {
    header("Content-Type: {$mimeType}; charset=utf-8");
    header("Content-Encoding: gzip");
    $file = fopen($filename, "r");
    fpassthru($file);
    fclose($file);
  }

  /**
   * Return contents of the gz file at $filename as an array
   * of lines, where every line is terminated by "\n".
   */
  public static function getLines($filename) {
    // gzfile breaks up very long lines, so we need to mend them.
    return self::mendBrokenLines(gzfile($filename));
  }

  public static function mendBrokenLines($lineArray) {
    for ($i = 0; $i < count($lineArray) - 1; $i++) {
      if (substr($lineArray[$i], -1) != "\n") {
        $lineArray[$i] .= $lineArray[$i + 1];
        array_splice($lineArray, $i + 1, 1);
        $i--;
      }
    }
    return $lineArray;
  }
}
