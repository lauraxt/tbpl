<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

// Returns the buildernames of all hidden builders belonging to the
// branch $_GET['branch'] as a JSON encoded array.

header("Content-Type: text/plain, charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Cache-Control: no-cache, must-revalidate");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

if (empty($_GET['branch']))
  die("No branch set.");

$mongo = new Mongo();
$mongo->tbpl->builders->ensureIndex(array('branch' => true));
$result = $mongo->tbpl->builders->find(
            array('branch' => $_GET['branch'], 'hidden' => true),
            array('_id' => 0, 'buildername' => 1));
$hiddenBuilderNames = array();
foreach ($result as $builder) {
  $hiddenBuilderNames[] = $builder['buildername'];
}
echo json_encode($hiddenBuilderNames) . "\n";
