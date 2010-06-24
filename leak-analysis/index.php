<?php

if (!isset($_GET["tree"]) || !isset($_GET["id"]))
  die("tree or id not set");

if (!preg_match('/^[a-zA-Z0-9-]+$/', $_GET["tree"]))
  die("invalid tree");

if (!preg_match('/^\d+\.\d+\.\d+\.gz$/', $_GET["id"]))
  die("invalid id");

set_time_limit(120);

echo analyze($_GET["tree"], $_GET["id"]);

function analyze($tree, $id) {
  $file = "../summaries/LeakAnalysis_" . $tree . "_" . $id;
  if (file_exists($file))
    return file_get_contents($file);

  $host = "tinderbox.mozilla.org";
  $page = "/showlog.cgi?log=" . $tree . "/" . $id; // . 1233853948.1233859186.27458.gz";
  $page .= "&fulltext=1";
  $fp = fsockopen($host, 80, $errno, $errdesc);
  if (!$fp)
    return "Couldn't connect to $host:\nError: $errno\nDesc: $errdesc\n";
  $request = "GET $page HTTP/1.0\r\n";
  $request .= "Host: $host\r\n";
  $request .= "User-Agent: PHP test client\r\n\r\n";
  $lines = array();
  fputs ($fp, $request);
  stream_set_timeout($fp, 20);
  stream_set_blocking($fp, 0);
  $fileExistedAfterAll = false;
  $windows = array();
  $lastTestName = '';
  while (!feof($fp)) {
    if (file_exists($file)) {
      $fileExistedAfterAll = true;
      break;
    }
    $line = fgets($fp);
    // You would think that PHP would just return you a full line, wouldn't you?
    // Well, you'd be wrong!  Let's make sure of that.
    while (substr($line, -1) != "\n" && !feof($fp)) {
      $line .= fgets($fp);
    }
    $testName = getTestName($line);
    if ($testName) {
      $lastTestName = $testName;
      continue;
    }
    if (preg_match("/\+\+DOMWINDOW.*\(([0-9a-fx]+)\)\s*\[serial = (\d+)\]/i", $line, $matches)) {
      $windows[$matches[1] . '-' . $matches[2]] = $lastTestName;
    } else if (preg_match("/--DOMWINDOW.*\(([0-9a-fx]+)\)\s*\[serial = (\d+)\]/i", $line, $matches)) {
      unset($windows[$matches[1] . '-' . $matches[2]]);
    }
  }
  fclose($fp);
  if ($fileExistedAfterAll) {
    $result = file_get_contents($file);
  } else {
    // Reverse the array to get a mapping of test name to number of DOMWINDOWS leaked
    $leaks = array();
    foreach ($windows as $id => $testName) {
      if (!isset($leaks[$testName])) {
        $leaks[$testName] = 0;
      }
      ++$leaks[$testName];
    }
    if (count($leaks)) {
      foreach ($leaks as $testName => $num) {
        $result .= "<h1 style=\"color: red;\">$testName leaked $num DOMWINDOW(s)</h1>";
        // Heuristic for bug 538462
        if (preg_match("/test_unknownContentType_dialog_layout\.xul$/", $testName)) {
          $result .= "<p>(This is <a href=\"https://bugzilla.mozilla.org/show_bug.cgi?id=538462\">bug 538462</a>.)</p>";
        }
      }
    } else {
      $result = "<h1 style=\"color: green;\">No DOMWINDOWs leaked!</h1>";
    }
  }
  file_put_contents($file, $result);
  return $result;
}

function getTestName($line) {
  $line = trim($line);
  if (preg_match("/^REFTEST INFO | Loading ([^ ]+)$/", $line, $matches)) {
    return $matches[1];
  } else if (preg_match("/^\d+ INFO Running ([^ ]+)...$/", $line, $matches)) {
    return $matches[1];
  } else if (preg_match("/^Running ([^ ]+)...$/", $line, $matches)) {
    return $matches[1];
  } else {
    return null;
  }
}

?>
