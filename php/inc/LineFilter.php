<?php
/* -*- Mode: PHP; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

interface LineFilter {
  /* A small string that describes the filter and
   * will be included in the cache filename. */
  public function getType();

  /* true if the whole line should be part of the excerpt,
   * a string if a transformed form of the line should be part of the excerpt,
   * false otherwise. */
  public function matchLine($line);
}
