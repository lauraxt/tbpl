<?php

if (!isset($_GET["url"]))
  die("no URL set");

$url = "http://hg.mozilla.org/" . preg_replace("/ /", "+", $_GET["url"]);

header("Content-Type: text/html,charset=utf-8");
header("Access-Control-Allow-Origin: *");

// Disable caching in the way suggested by php.net/header
header("Cache-Control: no-cache, must-revalidate"); // HTTP/1.1
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT"); // Date in the past

$code = file_get_contents($url);
$code = preg_replace("/<link.*>/Ui", "", 
        preg_replace("/<img.*>/Ui", "",
        preg_replace("/<script/Ui", "<textarea class=script",
        preg_replace("/<\/script/Ui", "</textarea",
                     $code))));
if ($site == "tinderbox") {
    $code = preg_replace("/<style.*\/style>/Ui", "",
            preg_replace("/<li data\-status.*\/li>/Ui", "",
            preg_replace("/<iframe.*\/iframe>/Ui", "",
                         $code)));
}

echo $code;
