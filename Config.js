var Config = {
  tinderboxDataLoader: TinderboxJSONUser,
  pushlogDataLoader: PushlogHTMLParser,
  defaultTreeName: "Firefox",
  mvtTimezone: "-0700",
  loadInterval: 120, // seconds
  repoNames: {
    "Firefox": "mozilla-central",
    "Firefox3.5": "releases/mozilla-1.9.1",
    "TraceMonkey": "tracemonkey",
    "Thunderbird": "comm-central",
    "Thunderbird3.0": "comm-central",
    "SeaMonkey": "comm-central",
    "SeaMonkey2.0": "comm-central",
    "Sunbird": "comm-central",
    "MozillaTry": "try",
    "Places": "projects/places/",
  },
};
