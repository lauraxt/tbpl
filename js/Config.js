var Config = {
  tinderboxDataLoader: TinderboxJSONUser,
  pushlogDataLoader: PushlogHTMLParser,
  defaultTreeName: "Firefox",
  mvtTimezoneOffset: -7,
  mvtTimezoneName: "PDT",
  loadInterval: 120, // seconds
  baseURL: "",
  repoNames: {
    "Firefox": "mozilla-central",
    "Firefox3.6": "releases/mozilla-1.9.2",
    "Firefox3.5": "releases/mozilla-1.9.1",
    "Firefox-Lorentz": "projects/firefox-lorentz",
    "TraceMonkey": "tracemonkey",
    "Jaegermonkey": "projects/jaegermonkey",
    "Electrolysis": "projects/electrolysis",
    "Places": "projects/places/",
    "Mobile": "mozilla-central",
    "MozillaTry": "try",
    "AddonsMgr": "projects/addonsmgr",
    "Birch": "projects/birch",
    "Cedar": "projects/cedar",
    "Maple": "projects/maple",
  },
  // Trees that have split mochitests like M(12345).
  treesWithGroups: [
    "Firefox",
    "TraceMonkey",
    "Jaegermonkey",
    "AddonsMgr",
    "MozillaTry",
    "Birch",
    "Cedar",
    "Maple",
  ],
  OSNames: {
    "linux": "Linux",
    "linux64": "Linux64",
    "osx":"OS X",
    "osx64": "OS X64",
    "windowsxp": "WinXP",
    "windows2003": "Win2003",
    "windows7": "Win7",
    "windows7-64": "Win7-64",
    "android": "Android",
    "maemo5": "Maemo 5",
    "maemo4": "Maemo 4"
  }
};
