<?php

if (!isset($_GET["tree"]) || !isset($_GET["id"]))
  die("tree or id not set");

echo getSummary($_GET["tree"], $_GET["id"]);

function getSummary($tree, $id) {
  $file = $tree . "_" . $id;
  if (file_exists($file))
    return file_get_contents($file);

  $host = "tinderbox.mozilla.org";
  $page = "/showlog.cgi?log=" . $tree . "/" . $id; // . 1233853948.1233859186.27458.gz";
  $fp = fsockopen($host, 80, &$errno, &$errdesc);
  if (!$fp)
    return "Couldn't connect to $host:\nError: $errno\nDesc: $errdesc\n";
  $request = "GET $page HTTP/1.0\r\n";
  $request .= "Host: $host\r\n";
  $request .= "User-Agent: PHP test client\r\n\r\n";
  $lines = array();
  fputs ($fp, $request);
  stream_set_timeout($fp, 20);
  stream_set_blocking($fp, 0);
  $foundSummaryStart = false;
  $fileExistedAfterAll = false;
  $isStillRunning = false;
  while (!feof($fp)) {
    if (file_exists($file)) {
      $fileExistedAfterAll = true;
      break;
    }
    $line = fgets($fp, 1024);
    if ($line != "") {
      if (!$foundSummaryStart) {
        if (preg_match("/Build Error Summary.*Build Error Log.*No More Errors/i", $line)) {
          $isStillRunning = true;
          break;
        }
        if (preg_match("/Build Error Summary.*Build Error Log/i", $line)) {
          // Summary is empty.
          break;
        }
        if (preg_match_all("/Build Error Summary.*<PRE>(.*)$/i", $line, $m)) {
          $foundSummaryStart = true;
          $line = $m[1][0];
          $lines[] = $line;
        }
      } else {
        if (preg_match("/Build Error Log/i", $line))
          break;
        $lines[] = $line;
      }
    } else {
      usleep(80 * 1000);
    }
  }
  fclose($fp);
  $summary = $fileExistedAfterAll ? file_get_contents($file) : strip_tags(implode($lines));
  if (!file_exists($file) && !$isStillRunning)
    file_put_contents($file, $summary);
  return $summary;
}
