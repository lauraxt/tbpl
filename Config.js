var Config = {
  tinderboxDataLoader: TinderboxJSONUser,
  pushlogDataLoader: PushlogHTMLParser,
  defaultTreeName: "Firefox",
  mvtTimezone: "-0800",
  loadInterval: 120, // seconds
  repoNames: {
    "Firefox": "mozilla-central",
    "Firefox3.6": "releases/mozilla-1.9.2",
    "Firefox3.5": "releases/mozilla-1.9.1",
    "TraceMonkey": "tracemonkey",
    "Electrolysis": "projects/electrolysis",
    "Places": "projects/places/",
    "Mobile": "mozilla-cental",
    "MozillaTry": "try",
  },
};
