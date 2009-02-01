<?php

$site = isset($_GET["site"]) ? $_GET["site"] : "tinderbox";
$tree = isset($_GET["tree"]) ? $_GET["tree"] : "Firefox";

$url = $site == "tinderbox" ? "http://tinderbox.mozilla.org/" . $tree . "/" :
        ($tree == "Firefox3.1" ?  "http://hg.mozilla.org/releases/mozilla-1.9.1/pushloghtml?startdate=16+hours+ago&enddate=now" :
        ($tree == "TraceMonkey" ? "http://hg.mozilla.org/tracemonkey/pushloghtml?startdate=16+hours+ago&enddate=now" :
        ($tree == "Thunderbird" || $tree == "SeaMonkey" ? "http://hg.mozilla.org/comm-central/pushloghtml?startdate=16+hours+ago&enddate=now" :
                                  "http://hg.mozilla.org/mozilla-central/pushloghtml?startdate=16+hours+ago&enddate=now")));

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
