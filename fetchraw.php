<?php

$site = isset($_GET["site"]) ? $_GET["site"] : "tinderbox";
$tree = isset($_GET["tree"]) ? $_GET["tree"] : "Firefox";

$url = $site == "tinderbox" ? "http://tinderbox.mozilla.org/" . $tree . "/" : ($tree == "Firefox3.1" ? "http://hg.mozilla.org/releases/mozilla-1.9.1/pushloghtml?startdate=16+hours+ago&enddate=now" : ($tree == "TraceMonkey" ? "http://hg.mozilla.org/tracemonkey/pushloghtml?startdate=16+hours+ago&enddate=now" : "http://hg.mozilla.org/mozilla-central/pushloghtml?startdate=16+hours+ago&enddate=now"));

header("Content-Type: text/html,charset=utf-8");
echo preg_replace("/\<iframe.*\/iframe>/Ui", "", file_get_contents($url));