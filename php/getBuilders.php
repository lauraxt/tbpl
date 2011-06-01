<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

// Returns all builders belonging to a branch with the following format:
// [ { "name": "...", "buildername": "...", "hidden": 0/1 }, ... ]
// hidden:0 may be ommitted.

header("Content-Type: text/plain, charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Cache-Control: no-cache, must-revalidate");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

if (empty($_GET['branch']))
  die("No branch set.");

$mongo = new Mongo();
$mongo->tbpl->builders->ensureIndex(array('branch' => true));
$result = $mongo->tbpl->builders->find(
            array('branch' => $_GET['branch']),
            array('_id' => 0, 'branch' => 0, 'history' => 0));
echo json_encode(iterator_to_array($result->sort(array('name'=>1)), false)) . "\n";
