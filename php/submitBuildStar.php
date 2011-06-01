<?php

header("Content-Type: text/plain, charset=utf-8");
header("Access-Control-Allow-Origin: *");

$mongo = new Mongo();

if (!isset($_POST["id"]))
  die("No id set.");

if (is_numeric($_POST["id"])) {
  // $_POST['id'] is a Buildbot ID.
  $run = $mongo->tbpl->runs->findOne(
    array('_id' => +$_POST['id']),
    array('_id' => 1));
  if ($run === NULL)
    die("No build with that id in database.");
} else {
  // $_POST['id'] is not a Buildbot ID; it could be a Tinderbox result ID.
  // TBPL with Tinderbox backend doesn't know the Buildbot ID of a run,
  // so it lets us figure it out from the slave name and the start time
  // of the run.
  if (empty($_POST["machinename"]))
    die("No machinename provided.");
  if (empty($_POST["starttime"]))
    die("No starttime provided.");

  $run = $mongo->tbpl->runs->findOne(
    array('slave' => $_POST["machinename"],
          'starttime' => +$_POST["starttime"]),
    array('_id' => 1));
  if ($run === NULL)
    die("No build with that slave/starttime combination in database.");
}

if (!isset($_POST["who"]))
  die("No author ('who') provided.");
if (!isset($_POST["note"]))
  die("No note provided.");

$noteObject = array(
  'who' => $_POST["who"],
  'note' => $_POST["note"],
  'timestamp' => time(),
  'ip' => $_SERVER['REMOTE_ADDR']
);
$mongo->tbpl->runs->update($run, array('$push' => array('notes' => $noteObject)));
