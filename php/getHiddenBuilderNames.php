<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

// Returns the buildernames of all hidden builders belonging to the
// branch $_GET['branch'] as a JSON encoded array.

require_once 'inc/HiddenBuilders.php';

header("Content-Type: text/plain, charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Cache-Control: no-cache, must-revalidate");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

if (empty($_GET['branch']))
  die("No branch set.");

echo json_encode(getHiddenBuilderNames($_GET['branch'])) . "\n";
