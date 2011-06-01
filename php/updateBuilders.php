<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

// Applies changes to the hidden status of builders.
// Input parameters (POST):
//  - who: the name / nick of the person who's making the change
//  - password: the sheriff password, stored in sheriff-password.php
//  - reason: the reason for the change
//  - actions: a JSON string that describes the changes that should
//    be made. It has the following format:
//     { 'name of builder': 'hide / unhide', ... }
//    Unlisted builders stay unchanged.

require_once 'sheriff-password.php';
if (!defined('SHERIFF_PASSWORD'))
  die('Sheriff password missing.');

header("Content-Type: text/plain, charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Cache-Control: no-cache, must-revalidate");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

if (empty($_POST['actions']))
  die("No actions set.");

if (empty($_POST['who']))
  die("No who set.");

if (empty($_POST['reason']))
  die("No reason set.");

if (empty($_POST['password']))
  die("No password set.");

if ($_POST['password'] != SHERIFF_PASSWORD)
  die('{"error": "password"}');

$actions = json_decode($_POST['actions']);

$who = $_POST['who'];
$ip = $_SERVER['REMOTE_ADDR'];
$reason = $_POST['reason'];

$mongo = new Mongo();
foreach ($actions as $name => $action) {
  $current = $mongo->tbpl->builders->findOne(
    array('name' => $name), array('hidden' => 1));
  if ($current === NULL)
    continue;
  $currentlyHidden = !empty($current['hidden']);
  if (($currentlyHidden && $action != 'unhide') ||
      (!$currentlyHidden && $action != 'hide'))
    continue;
  $newHidden = ($action == 'hide');
  $historyEntry = array(
    'date' => time(),
    'action' => $action,
    'who' => $who,
    'reason' => $reason,
    'ip' => $ip);
  $mongo->tbpl->builders->update(
    array('name' => $name),
    array('$set' => array('hidden' => $newHidden),
          '$push' => array('history' => $historyEntry)));
}
