<?php

require_once './tbplbot.password';

if (!defined('TBPLBOT_PASSWORD'))
  die('Invalid configuration!');

if (!isset($_GET['id']) || !isset($_GET['comment']))
  die('Invalid params!');

if (!function_exists('curl_init'))
  die('Needs CURL!');

$id = (int) $_GET['id'];
if ($id <=0)
  die('Invalid Bug ID specified');

$url = "https://api-dev.bugzilla.mozilla.org/latest/bug/$id/comment?username=tbplbot@gmail.com&password=" . urlencode(TBPLBOT_PASSWORD);
$data = '{"text":"' . str_replace("\n", '\\n', str_replace('"', '\\"', $_GET['comment'])) . '"}';

// check to make sure that the bug has not already been commented on
$bug_comments = file_get_contents("https://api-dev.bugzilla.mozilla.org/latest/bug/$id?comments=1");
if ($bug_comments !== false) {
  if (preg_match("/([\d]+\.[\d]+\.[\d]+)\.gz$/", $_GET['comment'], $matches)) {
    $id = $matches[1];
    if (strpos($bug_comments, $id) !== false)
      exit;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_HTTPHEADER, array("Accept: application/json", "Content-Type: application/json"));
echo curl_exec($ch);
curl_close($ch);

?>
