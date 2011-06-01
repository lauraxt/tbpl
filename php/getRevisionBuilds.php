<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

header("Content-Type: text/plain, charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Cache-Control: no-cache, must-revalidate");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

if (!isset($_GET['branch']) || !$_GET['branch'])
  die("No branch set.");
if (!isset($_GET['rev']) || !$_GET['rev'])
  die("No revision set.");

$mongo = new Mongo();
$result = $mongo->tbpl->runs->find(
            array('branch' => $_GET['branch'], 'revision' => $_GET['rev']),
            array('branch' => 0, 'revision' => 0, 'log' => 0));
echo json_encode(iterator_to_array($result, false)) . "\n";
