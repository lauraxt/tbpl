var Config = {
  tinderboxDataLoader: TinderboxJSONUser,
  pushlogDataLoader: PushlogHTMLParser,
  defaultTreeName: "Firefox",
  mvtTimezoneOffset: -8,
  mvtTimezoneName: "PST",
  loadInterval: 120, // seconds
  repoNames: {
    "Firefox": "mozilla-central",
    "Firefox3.6": "releases/mozilla-1.9.2",
    "Firefox3.5": "releases/mozilla-1.9.1",
    "TraceMonkey": "tracemonkey",
    "Electrolysis": "projects/electrolysis",
    "Places": "projects/places/",
    "Mobile": "mozilla-central",
    "MozillaTry": "try",
  },
};
