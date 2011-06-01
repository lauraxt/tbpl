/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

var BuildbotDBUser = {

  load: function BuildbotDBUser_load(tree, forPushes, noIgnore, loadTracker, loadCallback, data) {
    var self = this;
    var branch = Config.treeInfo[tree].buildbotBranch;
    forPushes.reverse(); // Load recent pushes first.
    forPushes.forEach(function (push) {
      loadTracker.addTrackedLoad();
      $.ajax({
        url: Config.baseURL + 'php/getRevisionBuilds.php?branch=' + branch + '&rev=' + push.defaultTip,
        dataType: 'json',
        success: function (json) {
          var runs = json.filter(function (run) { return Config.hiddenBuilds.indexOf(run.buildername) == -1; });
          loadCallback(self._createMachineResults(tree, push.defaultTip, data, runs));
          loadTracker.loadCompleted();
        },
        error: function (request, textStatus, error) {
          loadTracker.loadFailed(textStatus);
        },
        cache: false,
      });
    });
  },

  _createMachineResults: function BuildbotDBUser__createMachineResults(tree, rev, data, runs) {
    var machineResults = {};
    runs.forEach(function (run) {
      var machine = data.getMachine(run.buildername);
      if (!machine)
        return;
      var revs = {};
      revs[Config.treeInfo[tree].primaryRepo] = rev;
      var runID = "" + run._id;
      machineResults[runID] = new MachineResult({
        "tree" : tree,
        "machine": machine,
        "slave": run.slave,
        "runID": runID,
        "state": run.result,
        "startTime": new Date(run.starttime * 1000),
        "endTime": new Date(run.endtime * 1000),
        "briefLogURL": Config.baseURL + 'php/getParsedLog.php?id=' + run._id,
        "fullLogURL": Config.baseURL + 'php/getParsedLog.php?id=' + run._id + '&full=1',
        "summaryURL": Config.baseURL + "php/getLogExcerpt.php?id=" + run._id,
        "annotatedSummaryURL": Config.baseURL + "php/getLogExcerpt.php?id=" + run._id + '&type=annotated',
        "reftestLogURL": Config.baseURL + "php/getLogExcerpt.php?id=" + run._id + '&type=reftest',
        "_scrapeURL": Config.baseURL + "php/getLogExcerpt.php?id=" + run._id + '&type=tinderbox_print',
        "revs": revs,
        "notes": [],
        "_similarBuildID": run._id,
      });
    });
    return machineResults;
  },
};
