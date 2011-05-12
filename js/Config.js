/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

var Config = {
  tinderboxDataLoader: TinderboxJSONUser,
  pushlogDataLoader: PushlogJSONParser,
  defaultTreeName: "Firefox",
  mvtTimezoneOffset: -7,
  mvtTimezoneName: "PDT",
  loadInterval: 120, // seconds
  goBackPushes: 10,
  baseURL: "",
  useGoogleCalendar: true,
  jsonPendingOrRunningBaseURL: "http://build.mozilla.org/builds/",
  htmlPendingOrRunningBaseURL: "http://build.mozilla.org/builds/",
  selfServeAPIBaseURL: "https://build.mozilla.org/buildapi/self-serve",
  alternateTinderboxPushlogURL: "http://build.mozillamessaging.com/tinderboxpushlog/?tree=",
  alternateTinderboxPushlogName: "Mozilla Messaging",
  wooBugURL: "http://brasstacks.mozilla.com/starcomment.php", // war-on-orange database
  // treeInfo gives details about the trees and repositories. There are various
  // items that can be specified:
  //
  // - primaryRepo:    [required] The primary hg repository for the tree.
  // - otherRepo:      [optional] An additional hg repository that the tree
  //                              works with.
  // - hasGroups:      [optional] If the builders should be grouped, specify
  //                              this option. If not, leave it out.
  // - orangeFactor:   [optional] If the tree is linked to the orange factor
  //                              specify this option. If not, leave it out.
  treeInfo: {
    "Firefox": {
      primaryRepo: "mozilla-central",
      hasGroups: true,
      orangeFactor: true,
      buildbotBranch: "mozilla-central",
    },
    "Mozilla-Beta": {
      primaryRepo: "releases/mozilla-beta",
      hasGroups: true,
      orangeFactor: true,
      buildbotBranch: "mozilla-beta",
    },
    "Mozilla-Aurora": {
      primaryRepo: "releases/mozilla-aurora",
      hasGroups: true,
      orangeFactor: true,
      buildbotBranch: "mozilla-aurora",
    },
    "Firefox4.0": {
      primaryRepo: "releases/mozilla-2.0",
      hasGroups: true,
      buildbotBranch: "mozilla-2.0",
    },
    "Firefox3.6": {
      primaryRepo: "releases/mozilla-1.9.2",
      buildbotBranch: "mozilla-1.9.2",
    },
    "Firefox3.5": {
      primaryRepo: "releases/mozilla-1.9.1",
      buildbotBranch: "mozilla-1.9.1",
    },
    "TraceMonkey": {
      primaryRepo: "tracemonkey",
      hasGroups: true,
      orangeFactor: true,
      buildbotBranch: "tracemonkey",
    },
    "Jaegermonkey": {
      primaryRepo: "projects/jaegermonkey",
      hasGroups: true,
      buildbotBranch: "jaegermonkey",
    },
    "Electrolysis": {
      primaryRepo: "projects/electrolysis",
      hasGroups: true,
    },
    "Places": {
      primaryRepo: "projects/places",
      hasGroups: true,
      orangeFactor: true,
      buildbotBranch: "places",
    },
    "Mobile": {
      primaryRepo: "mozilla-central",
      otherRepo: "mobile-browser",
      hasGroups: true,
      buildbotBranch: "mozilla-central",
    },
    "Mobile2.0": {
      primaryRepo: "releases/mozilla-2.1",
      otherRepo: "releases/mobile-2.0",
      hasGroups: true,
      buildbotBranch: "mozilla-2.1",
    },
    "Try": {
      primaryRepo: "try",
      hasGroups: true,
      buildbotBranch: "try",
    },
    "Build-System": {
      primaryRepo: "projects/build-system",
      hasGroups: true,
      buildbotBranch: "build-system",
    },
    "Devtools": {
      primaryRepo: "projects/devtools",
      hasGroups: true,
      buildbotBranch: "devtools",
    },
    "Graphics": {
      primaryRepo: "projects/graphics",
      hasGroups: true,
      buildbotBranch: "graphics",
    },
    "Services-Central": {
      primaryRepo: "services/services-central",
      hasGroups: true,
      buildbotBranch: "services-central",
    },
    "Birch": {
      primaryRepo: "projects/birch",
      hasGroups: true,
      buildbotBranch: "birch",
    },
    "Cedar": {
      primaryRepo: "projects/cedar",
      hasGroups: true,
      buildbotBranch: "cedar",
    },
    "Maple": {
      primaryRepo: "projects/maple",
      hasGroups: true,
      buildbotBranch: "maple",
    },
    "Alder": {
      primaryRepo: "projects/alder",
      hasGroups: true,
      buildbotBranch: "alder",
    },
    "Holly": {
      primaryRepo: "projects/holly",
      hasGroups: true,
      buildbotBranch: "holly",
    },
    "Larch": {
      primaryRepo: "projects/larch",
      hasGroups: true,
      buildbotBranch: "larch",
    },
    "Accessibility": {
      primaryRepo: "projects/accessibility",
      hasGroups: true,
      buildbotBranch: "accessibility",
    },
    "Private-Browsing": {
      primaryRepo: "projects/private-browsing",
      hasGroups: true,
      buildbotBranch: "private-browsing",
    },
    "UX": {
      primaryRepo: "projects/ux",
      hasGroups: true,
      buildbotBranch: "ux",
    },
  },
  groupedMachineTypes: {
    "Mochitest" : ["Mochitest"],
    "Reftest" : ["Crashtest", "Crashtest-IPC",
      "Reftest", "Reftest Unaccelerated", "Reftest-IPC", "JSReftest"],
    "SpiderMonkey" : ["SpiderMonkey DTrace", "SpiderMonkey --disable-methodjit",
      "SpiderMonkey --disable-tracejit", "SpiderMonkey Shark",
      "SpiderMonkey --enable-sm-fail-on-warnings"],
  },
  OSNames: {
    "linux": "Linux",
    "linux64": "Linux64",
    "osx":"OS X",
    "osx64": "OS X64",
    "windows": "Win",
    "windows7-64": "Win64",
    "windowsxp": "WinXP",
    "android": "Android",
    "maemo4": "Maemo 4",
    "maemo5": "Maemo 5"
  },
  testNames: {
    "Build" : "B",
    "Qt Build" : "Bq",
    "Mobile Desktop Build" : "Bm",
    "SpiderMonkey" : "SM",
    "SpiderMonkey DTrace" : "d",
    "SpiderMonkey --disable-methodjit" : "¬m",
    "SpiderMonkey --disable-tracejit" : "¬t",
    "SpiderMonkey Shark" : "s",
    "SpiderMonkey --enable-sm-fail-on-warnings" : "e",
    "Nightly" : "N",
    "Shark Nightly" : "Ns",
    "Mobile Desktop Nightly" : "Nm",
    "Maemo Qt Nightly" : "Nq",
    "RPM Nightly" : "Nr",
    "Mochitest" : "M",
    "Crashtest-IPC" : "Cipc",
    "Crashtest" : "C",
    "Reftest Unaccelerated" : "Ru",
    "Reftest-IPC" : "Ripc",
    "Reftest" : "R",
    "JSReftest" : "J",
    "XPCShellTest" : "X",
    "Talos Performance" : "T",
    "Jetpack SDK Test" : "JP",
    "Mozmill" : "Z",
    "Valgrind": "V",
    "Unit Test" : "U"
  },
  hiddenBuilds: [
    // Firefox:
    "Rev3 Fedora 12 mozilla-central debug test jetpack",
    "Rev3 Fedora 12 mozilla-central opt test jetpack",
    "Rev3 Fedora 12x64 mozilla-central debug test jetpack",
    "Rev3 Fedora 12x64 mozilla-central opt test jetpack",
    "Rev3 MacOSX Leopard 10.5.8 mozilla-central debug test jetpack",
    "Rev3 MacOSX Leopard 10.5.8 mozilla-central opt test jetpack",
    "Rev3 MacOSX Snow Leopard 10.6.2 mozilla-central debug test jetpack",
    "Rev3 MacOSX Snow Leopard 10.6.2 mozilla-central opt test jetpack",
    "Rev3 WINNT 5.1 mozilla-central opt test jetpack",
    "Rev3 WINNT 6.1 mozilla-central opt test jetpack",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test crashtest",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test jsreftest",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test mochitest-other",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test mochitests-1/5",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test mochitests-2/5",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test mochitests-3/5",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test mochitests-4/5",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test mochitests-5/5",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test reftest",
    "Rev3 WINNT 6.1 x64 mozilla-central debug test xpcshell",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test crashtest",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test jsreftest",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test mochitest-other",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test mochitests-1/5",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test mochitests-2/5",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test mochitests-3/5",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test mochitests-4/5",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test mochitests-5/5",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test reftest",
    "Rev3 WINNT 6.1 x64 mozilla-central opt test xpcshell",
    "Rev3 WINNT 6.1 x64 mozilla-central talos a11y",
    "Rev3 WINNT 6.1 x64 mozilla-central talos chrome",
    "Rev3 WINNT 6.1 x64 mozilla-central talos dirty",
    "Rev3 WINNT 6.1 x64 mozilla-central talos dromaeo",
    "Rev3 WINNT 6.1 x64 mozilla-central talos nochrome",
    "Rev3 WINNT 6.1 x64 mozilla-central talos scroll",
    "Rev3 WINNT 6.1 x64 mozilla-central talos svg",
    "Rev3 WINNT 6.1 x64 mozilla-central talos tp4",
    "WINNT 6.1 x86-64 mozilla-central build",
    "WINNT 6.1 x86-64 mozilla-central debug test crashtest",
    "WINNT 6.1 x86-64 mozilla-central debug test jsreftest",
    "WINNT 6.1 x86-64 mozilla-central debug test mochitest-other",
    "WINNT 6.1 x86-64 mozilla-central debug test mochitests-1/5",
    "WINNT 6.1 x86-64 mozilla-central debug test mochitests-2/5",
    "WINNT 6.1 x86-64 mozilla-central debug test mochitests-3/5",
    "WINNT 6.1 x86-64 mozilla-central debug test mochitests-4/5",
    "WINNT 6.1 x86-64 mozilla-central debug test mochitests-5/5",
    "WINNT 6.1 x86-64 mozilla-central debug test reftest",
    "WINNT 6.1 x86-64 mozilla-central debug test xpcshell",
    "WINNT 6.1 x86-64 mozilla-central leak test nightly",
    "WINNT 6.1 x86-64 mozilla-central nightly",
    "WINNT 6.1 x86-64 mozilla-central opt test crashtest",
    "WINNT 6.1 x86-64 mozilla-central opt test jsreftest",
    "WINNT 6.1 x86-64 mozilla-central opt test mochitest-other",
    "WINNT 6.1 x86-64 mozilla-central opt test mochitests-1/5",
    "WINNT 6.1 x86-64 mozilla-central opt test mochitests-2/5",
    "WINNT 6.1 x86-64 mozilla-central opt test mochitests-3/5",
    "WINNT 6.1 x86-64 mozilla-central opt test mochitests-4/5",
    "WINNT 6.1 x86-64 mozilla-central opt test mochitests-5/5",
    "WINNT 6.1 x86-64 mozilla-central opt test reftest",
    "WINNT 6.1 x86-64 mozilla-central opt test xpcshell",
  ],
  talosTestNames: [
   " a11y",
    "tdhtml",
    "tdhtml_nochrome",
    "tp4",
    "tp4_memset",
    "tp4_pbytes",
    "tp4_rss",
    "tp4_shutdown",
    "tp4_xres",
    "dromaeo_basics",
    "dromaeo_css",
    "dromaeo_dom",
    "dromaeo_jslib",
    "dromaeo_sunspider",
    "dromaeo_v8",
    "tsspider",
    "tsspider_nochrome",
    "tgfx",
    "tgfx_nochrome",
    "tscroll",
    "tsvg",
    "tsvg_opacity",
    "ts",
    "ts_cold",
    "ts_cold_generated_max",
    "ts_cold_generated_max_shutdown",
    "ts_cold_generated_med",
    "ts_cold_generated_med_shutdown",
    "ts_cold_generated_min",
    "ts_cold_generated_min_shutdown",
    "ts_cold_shutdown",
    "ts_places_generated_max",
    "ts_places_generated_max_shutdown",
    "ts_places_generated_med",
    "ts_places_generated_med_shutdown",
    "ts_places_generated_min",
    "ts_places_generated_min_shutdown",
    "ts_shutdown",
    "twinopen"
  ]
};
