/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

"use strict";

var BuildAPI = {

  getBuildsForRevision: function BuildAPI_getBuildsForRevision(tree, rev, successCallback, failCallback, timeoutCallback) {
    NetUtils.loadTextWithCredentials(
      Config.selfServeAPIBaseURL + '/' + tree + '/rev/' + rev + '?format=json',
      function getBuildsForRevision_Loaded(text) {
        try {
          successCallback(JSON.parse(text));
        } catch (e) {
          failCallback(e);
        }
      },
      failCallback, timeoutCallback);
  },

  _makeRequestResultLoadedCallback: function BuildAPI__makeRequestResultLoadedCallback(successCallback, failCallback) {
    return function requestResultLoaded(text) {
      try {
        var result = JSON.parse(text);
        if (result.status.toLowerCase() == 'ok') {
          successCallback();
        } else {
          failCallback(result.msg);
        }
      } catch (e) {
        failCallback(e);
      }
    };
  },

  rebuild: function BuildAPI_rebuild(tree, buildID, successCallback, failCallback, timeoutCallback) {
    NetUtils.crossDomainPostWithCredentials(
      Config.selfServeAPIBaseURL + '/' + tree + '/build',
      { Accept: 'application/json' },
      { build_id: buildID },
      this._makeRequestResultLoadedCallback(successCallback, failCallback),
      failCallback, timeoutCallback);
  },

  cancelRequest: function BuildAPI_cancelRequest(tree, requestID, successCallback, failCallback, timeoutCallback) {
    this._cancelRequestOrBuild(tree, requestID, 'request', successCallback, failCallback, timeoutCallback);
  },

  cancelBuild: function BuildAPI_cancelBuild(tree, buildID, successCallback, failCallback, timeoutCallback) {
    this._cancelRequestOrBuild(tree, buildID, 'build', successCallback, failCallback, timeoutCallback);
  },

  _cancelRequestOrBuild: function BuildAPI__cancelRequestOrBuild(tree, requestOrBuildID, type, successCallback, failCallback, timeoutCallback) {
    NetUtils.crossDomainPostWithCredentials(
      Config.selfServeAPIBaseURL + '/' + tree + '/' + type + '/' + requestOrBuildID,
      { Accept: 'application/json' },
      { _method: 'DELETE' },
      this._makeRequestResultLoadedCallback(successCallback, failCallback),
      failCallback, timeoutCallback);
  },
};
