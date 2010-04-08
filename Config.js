var Config = {
  tinderboxDataLoader: TinderboxJSONUser,
  pushlogDataLoader: PushlogHTMLParser,
  defaultTreeName: "Firefox",
  mvtTimezoneOffset: -7,
  mvtTimezoneName: "PDT",
  loadInterval: 120, // seconds
  repoNames: {
    "Firefox": "mozilla-central",
    "Firefox3.6": "releases/mozilla-1.9.2",
    "Firefox3.5": "releases/mozilla-1.9.1",
    "Firefox-Lorentz": "projects/firefox-lorentz",
    "TraceMonkey": "tracemonkey",
    "Electrolysis": "projects/electrolysis",
    "Places": "projects/places/",
    "Mobile": "mozilla-central",
    "MozillaTry": "try",
    "AddonsMgr": "projects/addonsmgr",
  },
};
