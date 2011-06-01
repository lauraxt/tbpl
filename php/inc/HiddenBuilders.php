<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

function getHiddenBuilderNames($branch) {
  $mongo = new Mongo();
  $mongo->tbpl->builders->ensureIndex(array('branch' => true));
  $result = $mongo->tbpl->builders->find(
              array('branch' => $_GET['branch'], 'hidden' => true),
              array('_id' => 0, 'buildername' => 1));
  $hiddenBuilderNames = array();
  foreach ($result as $builder) {
    $hiddenBuilderNames[] = $builder['buildername'];
  }
  return $hiddenBuilderNames;
}
