function TinderboxData(treeName, dataLoader, repoNames) {
  this._treeName = treeName;
  this._dataLoader = dataLoader;
  this._repoNames = repoNames;
  this._data = { machines: [], machineResults: {} };
}

TinderboxData.prototype = {

  machineTypes: [
    "Opt Build", "Debug Build", "Nightly",
    "Mochitest", "Opt Mochitest", "Debug Mochitest",
    "Crashtest", "Opt Crashtest", "Debug Crashtest",
    "Reftest", "Opt Reftest", "Debug Reftest",
    "JSReftest", "Opt JSReftest", "Debug JSReftest",
    "XPCShellTest", "Opt XPCShellTest", "Debug XPCShellTest",
    "Unit Test",
    "Talos",
    "Static Analysis"
  ],
  testNames: [
    "tdhtml",
    "tdhtml_nochrome",
    "tgfx",
    "tgfx_nochrome",
    "tjss",
    "tp4",
    "tp4_pbytes",
    "tp4_rss",
    "tp4_shutdown",
    "ts",
    "ts_shutdown",
    "ts_cold",
    "ts_cold_shutdown",
    "ts_cold_generated_min",
    "ts_cold_generated_min_shutdown",
    "ts_cold_generated_med",
    "ts_cold_generated_med_shutdown",
    "ts_cold_generated_max",
    "ts_cold_generated_max_shutdown",
    "ts_places_generated_min",
    "ts_places_generated_min_shutdown",
    "ts_places_generated_med",
    "ts_places_generated_med_shutdown",
    "ts_places_generated_max",
    "ts_places_generated_max_shutdown",
    "tsspider",
    "tsspider_nochrome",
    "tsvg",
    "tsvg_opacity",
    "twinopen"
  ],

  getRepoName: function TinderboxData_getRepoName() {
    return this._repoNames[this._treeName];
  },

  load: function TinderboxData_load(timeOffset, loadCallback, failCallback) {
    var self = this;
    this._dataLoader.load(
      this._treeName,
      timeOffset,
      function mainTreeLoadCallback(data) {
        self._data = data;
        loadCallback(self.getData());
      },
      failCallback
    );
  },

  getData: function TinderboxData_getData() {
    return this._data;
  },
}
