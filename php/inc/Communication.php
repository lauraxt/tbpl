<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

class Headers {
  const ALLOW_CROSS_ORIGIN = 1;
  const NO_CACHE           = 2;

  public static function send($flags = 0, $mimeType = "text/html") {
    header("Content-Type: {$mimeType}, charset=utf-8");
    if ($flags & self::ALLOW_CROSS_ORIGIN)
      header("Access-Control-Allow-Origin: *");
    if ($flags & self::NO_CACHE) {
      header("Cache-Control: no-cache, must-revalidate");
      header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");
    }
  }
}

function requireStringParameter($name, $set) {
  if (empty($set[$name]))
    die("Required parameter {$name} is empty or not set.");
  $value = $set[$name];
  if (!is_string($value))
    die("Required parameter {$name} is not a string.");
  return $value;
}
