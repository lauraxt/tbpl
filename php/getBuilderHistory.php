<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

// Returns the change history of the builder identified by $_GET['name'].
// [ { "date": 1306421449, "action": "insert / hide / unhide", "who": "...", "reason": "..." }, ... ]

header("Content-Type: text/plain, charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Cache-Control: no-cache, must-revalidate");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

if (empty($_GET['name']))
  die("No name set.");

$mongo = new Mongo();
$mongo->tbpl->builders->ensureIndex(array('name' => true));
$result = $mongo->tbpl->builders->findOne(
            array('name' => $_GET['name']),
            array('_id' => 0, 'name' => 0, 'history.ip' => 0));
echo json_encode($result['history']) . "\n";
