<?php

require_once './tbplbot-password.php';
require_once './JSON.php';

if (!defined('TBPLBOT_PASSWORD'))
  die('Invalid configuration!');

if (!isset($_REQUEST['id']) || !isset($_REQUEST['comment']))
  die('Invalid params!');

if (!function_exists('curl_init'))
  die('Needs CURL!');

$id = (int) $_REQUEST['id'];
if ($id <=0)
  die('Invalid Bug ID specified');

header("Content-Type: text/plain");
header("Access-Control-Allow-Origin: *");

$url = "https://api-dev.bugzilla.mozilla.org/latest/bug/$id/comment?username=tbplbot@gmail.com&password=" . urlencode(TBPLBOT_PASSWORD);
$json = new Services_JSON();
$data = array(
  "text" => sanitize($_REQUEST["comment"])
);
$data = $json->encode($data);

// check to make sure that the bug has not already been commented on
$bug_comments = file_get_contents("https://api-dev.bugzilla.mozilla.org/latest/bug/$id/comment");
if ($bug_comments !== false) {
  if (preg_match("/([\d]+\.[\d]+\.[\d]+)\.gz$/", $_REQUEST['comment'], $matches)) {
    $id = $matches[1];
    if (strpos($bug_comments, $id) !== false)
      exit;
  }
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, array("Accept: application/json", "Content-Type: application/json"));
$result = curl_exec($ch);

if ($result === false) {
  $error = array(
    "error" => curl_errno($ch)
  );
  echo $json->encode($error);
} else {
  echo $result;
}

curl_close($ch);

function sanitize($str) {
  // Remove UTF-8 non-breaking space character sequences (0xc2a0), and
  // replace them with normal spaces.
  return str_replace(chr(0xc2) . chr(0xa0), ' ', $str);
}

?>
