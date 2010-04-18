

var PerformanceComparator = {
  compareRevisions:
  function PerformanceComparator_compareRevisions(revs, callback) {
    var revResults = [];
    var sortData = {};
    revs.forEach(function(rev) {
      var push = Controller._data._getPushForRev(rev);
      push.perfResults.rev = rev;
      revResults.push(push.perfResults);
      sortData[rev] = push.date.getTime();
    });
    revResults.sort(function(a, b) {
      return sortData[a.rev] - sortData[b.rev];
    });

    var osNames = Config.OSNames;
    var testNames = Controller._data._tinderboxData.testNames;

    // generate a structure with column headers and % difference
    // in a format ready for conversion into different formats
    function makeResultsTable(results) {
      var rows = [];
      rows[0] = [""];
      for (var os in osNames) {
        var name = osNames[os];
        rows[0].push(name + " (" + results[0].rev + ")");
        rows[0].push(name + " (" + results[1].rev + ")");
        rows[0].push(name + " (% diff)");
      };

      testNames.forEach(function(testName) {
        var row = [testName];
        for (var os in osNames) {
          var rev1 = results[0][os][testName] || 0;
          var rev2 = results[1][os][testName] || 0;
          row.push(rev1);
          row.push(rev2);
          if (rev1 > 0 && rev2 > 0) {
            var diff = (rev2 - rev1) / rev2;
            diff = Math.round(diff * 100);
            row.push(diff + "%");
          }
          else
            row.push(" - ");
        }
        rows.push(row);
      });

      return rows;
    }

    var rows = makeResultsTable(revResults);
    callback(rows);
  }
};
