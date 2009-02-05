<?php

$site = isset($_GET["site"]) ? $_GET["site"] : "tinderbox";
$url = isset($_GET["url"]) ? preg_replace("/ /", "+", $_GET["url"]) : "";

$url = ($site == "tinderbox" ? "http://tinderbox.mozilla.org/" : "http://hg.mozilla.org/") . $url;
header("Content-Type: text/html,charset=utf-8");

$code = file_get_contents($url);
$code = preg_replace("/<link.*>/Ui", "", 
        preg_replace("/<img.*>/Ui", "",
                     $code));
if ($site == "tinderbox") {
    $code = preg_replace("/<style.*\/style>/Ui", "",
            preg_replace("/<li data\-status.*\/li>/Ui", "",
            preg_replace("/<iframe.*\/iframe>/Ui", "",
            preg_replace("/<script/Ui", "<textarea class=script",
            preg_replace("/<\/script/Ui", "</textarea",
                         $code)))));
}

echo $code;
