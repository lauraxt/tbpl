#!/usr/bin/python

# This script imports run data from build.mozilla.org into the local MongoDB;
# specifically, into the "runs" table of the "tbpl" database.
# The data saved in the database is made accessible to TBPL clients via the
# php/get*.php scripts.
# TBPL clients don't request run data from build.mozilla.org directly for
# performance reasons. The JSON files are very large and include data from
# all branches, and most of that data isn't of interest to TBPL.

import json
import urllib2
import os
import datetime
import gzip
import StringIO
import time
import re
import optparse
from pymongo import Connection
from string import Template

log_path_try = Template("http://ftp.mozilla.org/pub/mozilla.org/firefox/try-builds/$pusher-$rev/$branch_platform/$builder-build$buildnumber.txt.gz")
log_path_other = Template("http://ftp.mozilla.org/pub/mozilla.org/firefox/tinderbox-builds/$branch_platform/$buildid/$builder-build$buildnumber.txt.gz")

try_pushers = {}

def try_pusher(rev):
    """Returns the pusher (an email address) of the try push with tip revision rev."""
    if rev not in try_pushers:
        try:
            io = urllib2.urlopen("http://hg.mozilla.org/try/json-pushes?changeset=" + rev)
        except urllib2.HTTPError:
            return None
        pushinfo = json.load(io).values()
        io.close()
        if not pushinfo:
            return None
        try_pushers[rev] = pushinfo[0].get("user")
    return try_pushers[rev]

def buildidnumber(buildid):
    """Converts "20110509111413" to 1304964853, because that's the form used in log URLs."""
    if len(buildid) != 14:
        return None
    (Y, m, d) = (int(buildid[0:4]), int(buildid[4:6]), int(buildid[6:8]))
    (H, i, s) = (int(buildid[8:10]), int(buildid[10:12]), int(buildid[12:14]))
    return int(time.mktime(datetime.datetime(Y, m, d, H, i, s).timetuple()))

def fix_revision(revision):
    if revision is None:
        return ""
    return revision[0:12]

def convert_status(status):
    # from http://hg.mozilla.org/build/buildbot/file/7348713b55c5/buildbot/status/builder.py#l23
    return {
        0: "success",
        1: "testfailed",
        2: "busted",
        3: "skipped",
        4: "exception",
        5: "retry",
    }.get(status, "unknown")

class Run(object):
    def __init__(self, build, builder, slave):
        self.id = build["id"]
        self._build = build
        self._props = build["properties"]
        self._builder = builder
        self._slave = slave
        self._rev = fix_revision(self._props["revision"])

    def get_info(self):
        info = {
            "_id": self.id,
            "buildername": self._props.get("buildername", self._builder), # builder ux_leopard_test-scroll doesn't have a props["buildername"]
            "slave": self._slave,
            "revision": self._rev,
            "starttime": self._build["starttime"],
            "endtime": self._build["endtime"],
            "result": convert_status(self._build["result"]),
            "branch": self._props["branch"],
        }
        log = self._log()
        if log:
            info["log"] = log
        return info

    def _log(self):
        """Return the log URL for this run, or None if it can't be figured out."""
        # Ignore packageUrl, build_url and fileURL since the logs might be in a
        # totally different directory than the used binary. This happens at least
        # for mobile builds, and in different ways:
        #  1. Builds are in .../mobile/..., but the logs might be in .../firefox/... Bug 637838
        #  2. Builds are in .../try-mob-andrd-r7-bld/ but logs in .../try-android-r7/ Bug 655046
        data = {
          "builder": self._builder,
          "buildnumber": self._props["buildnumber"],
          "branch_platform": self._branchplatform(),
          "rev": self._rev,
        }
        if self._props["branch"] in ["try", "try-mobile-browser"]:
            data["pusher"] = try_pusher(self._rev)
            if all(data.values()):
                return log_path_try.substitute(data)
        elif "buildid" in self._props:
            data["buildid"] = buildidnumber(self._props["buildid"])
            if all(data.values()):
                return log_path_other.substitute(data)
        return None

    def _branchplatform(self):
        """Constructs the directory name that's based on branch and platform.
        The rules for this have been reverse-engineered."""
        platform = self._props.get("build_platform", self._props.get("platform"))
        if not platform: # probably because it's a nightly l10n build (what is that?)
            return None
        dir = self._props["branch"] + "-" + platform
        # inconsistency: sometimes "-debug" is included, sometimes it's not
        if "-debug" in self._builder and not dir.endswith("-debug"):
            dir += "-debug"
        # another inconsistency: android logs are in special directories
        dir = dir.replace("mobile-browser-android", "android-r7")
        if self._props["branch"] in ["mozilla-1.9.1", "mozilla-1.9.2"] and "-unittest" in self._builder:
            dir += "-unittest"
        return dir

def json_from_gz_url(url):
    """Returns the JSON parsed object found at url."""
    io = urllib2.urlopen(url)
    # thanks to http://diveintopython.org/http_web_services/gzip_compression.html
    sio = StringIO.StringIO(io.read())
    io.close()
    gz = gzip.GzipFile(fileobj=sio)
    j = json.load(gz, encoding="UTF-8")
    gz.close()
    return j

def get_runs(url):
    try:
        print "Fetching", url, "..."
        j = json_from_gz_url(url)
    except urllib2.HTTPError, ex:
        if ex.code == 404:
            # It's ok for the file to be missing.
            return
        raise
    print "Traversing runs and inserting into database..."
    for build in j["builds"]:
        p = build["properties"]
        # some builds (which?) have no revision field, some (like fuzzer)
        # have null in the JSON, which turns into None in python, and some
        # (like addontester) have "None" in the JSON.
        if not p.get("revision") or not p.get("branch"):
            # Builds with no revision/branch aren't of interest.
            continue
        if build["result"] is None:
            # Ignore builds with unspecified result for now.
            continue
        builder = j["builders"][str(build["builder_id"])]["name"]
        slave = j["slaves"][str(build["slave_id"])]
        yield Run(build, builder, slave)

def add_to_db(url, table):
    i = 0
    for run in get_runs(url):
        if not table.find_one({"_id": run.id}):
            table.insert(run.get_info())
            i = i + 1
    print "Inserted", i, "new run entries."

def do_date(date, table):
    add_to_db(date.strftime("http://build.mozilla.org/builds/builds-%Y-%m-%d.js.gz"), table)

def do_recent(table):
    add_to_db("http://build.mozilla.org/builds/builds-4hr.js.gz", table)

os.environ["TZ"] = "America/Los_Angeles"
time.tzset()

parser = optparse.OptionParser(usage="""
%prog [options]

Import run information from JSON files on build.mozilla.org into the local MongoDB database.
""")
parser.add_option("-d","--days",help="number of days to import",type=int,default=0)
(options,args) = parser.parse_args()

runs = Connection().tbpl.runs
do_recent(runs)

today = datetime.date.today()

for i in range(options.days):
    do_date(today - datetime.timedelta(i), runs)