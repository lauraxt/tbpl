#!/usr/bin/python

# This script imports run data from build.mozilla.org into the local MongoDB;
# specifically, into the "runs" table of the "tbpl" database.
# The data saved in the database is made accessible to TBPL clients via the
# php/get*.php scripts.
# TBPL clients don't request run data from build.mozilla.org directly for
# performance reasons. The JSON files are very large and include data from
# all branches, and most of that data isn't of interest to TBPL.

import urllib2
import os
import datetime
import gzip
import StringIO
import time
import re
import optparse
import pytz
from pymongo import Connection
from string import Template

try:
   import simplejson as json
except ImportError:
   import json

log_path_try = Template("http://ftp.mozilla.org/pub/mozilla.org/$product/try-builds/$pusher-$rev/$branch_platform/$builder-build$buildnumber.txt.gz")
log_path_other = Template("http://ftp.mozilla.org/pub/mozilla.org/$product/tinderbox-builds/$branch_platform/$buildid/$builder-build$buildnumber.txt.gz")

verify_log_existence = False

try_pushers = {}

def try_pusher(rev):
    """Returns the pusher (an email address) of the try push with tip revision rev."""
    if rev not in try_pushers:
        try:
            io = urllib2.urlopen("http://hg.mozilla.org/try/json-pushes?changeset=" + rev)
        except urllib2.HTTPError:
            return None
        try:
            pushinfo = json.load(io).values()
        except ValueError:
            print "Warning: Invalid JSON returned by pushlog when asking for pusher of revision", rev
            return None
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
    tzinfo = pytz.timezone("America/Los_Angeles")
    return int(time.mktime(datetime.datetime(Y, m, d, H, i, s, 0, tzinfo).utctimetuple()))

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
            if verify_log_existence:
                self._verify_existence_of_log(log)
            info["log"] = log
        return info

    def _log(self):
        """Return the log URL for this run, or None if it can't be figured out."""
        data = {
          "builder": self._builder,
          "buildnumber": self._props["buildnumber"],
          "branch_platform": self._branchplatform(),
          "rev": self._rev,
          "product": self._props.get("product", "firefox"),
        }
        if self._props["branch"] == "try":
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
        platform = self._props.get("stage_platform", self._props.get("platform"))
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

    def _verify_existence_of_log(self, logurl):
        try:
            io = urllib2.urlopen(logurl)
        except urllib2.HTTPError, ex:
            print "Log not available:"
            print self.id, logurl

def json_from_gz_url(url):
    """Returns the JSON parsed object found at url."""
    try:
        io = urllib2.urlopen(url)
    except urllib2.HTTPError, ex:
        if ex.code == 404:
            # It's ok for the file to be missing.
            return
        raise
    # thanks to http://diveintopython.org/http_web_services/gzip_compression.html
    sio = StringIO.StringIO(io.read())
    io.close()
    gz = gzip.GzipFile(fileobj=sio)
    j = json.load(gz, encoding="UTF-8")
    gz.close()
    return j

def get_runs(j):
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
        slave_id = str(build["slave_id"])
        slave = j["slaves"].get(slave_id)
        if slave is None:
            print "Warning: The slave", slave_id, "for build", build["id"], "doesn't exist in the slave list."
            continue
        yield Run(build, builder, slave)

def get_builders(j):
    for build in j["builds"]:
        builder = j["builders"][str(build["builder_id"])]
        props = build["properties"]
        if "buildername" not in builder and "buildername" in props:
            builder["buildername"] = props["buildername"]
    for builder in j["builders"].values():
        yield builder["name"], builder["category"], builder.get("buildername")

def add_run_to_db(run, db):
    if db.runs.find_one({"_id": run.id}):
        return False
    db.runs.insert(run.get_info())
    return True

def add_builder_to_db(builder, db):
    (name, branch, buildername) = builder
    existing = db.builders.find_one({"name": name}, {"buildername": 1})
    if not existing:
        db.builders.insert({
            "name": name,
            "branch": branch,
            "buildername": buildername,
            "history": [{
                "date": int(time.time()),
                "action": "insert"
            }]
        })
        return True
    if existing["buildername"] is None and buildername is not None:
        db.builders.update({"name": name}, {"$set": {"buildername": buildername}})
        return True
    return False

def add_to_db(url, db):
    print "Fetching", url, "..."
    j = json_from_gz_url(url)
    if j is None:
        return

    print "Traversing runs and inserting into database..."
    count = sum([add_run_to_db(run, db) for run in get_runs(j)])
    print "Inserted", count, "new run entries."

    print "Traversing builders and updating database..."
    db.builders.ensure_index("name")
    count = sum([add_builder_to_db(builder, db) for builder in get_builders(j)])
    print "Updated", count, "builders."

def do_date(date, db):
    add_to_db(date.strftime("http://build.mozilla.org/builds/builds-%Y-%m-%d.js.gz"), db)

def do_recent(db):
    add_to_db("http://build.mozilla.org/builds/builds-4hr.js.gz", db)

usage = """
%prog [options]

Import run information from JSON files on build.mozilla.org into the local MongoDB database."""

def main():
    parser = optparse.OptionParser(usage=usage)
    parser.add_option("-d","--days",help="number of days to import",type=int,default=0)
    (options,args) = parser.parse_args()

    # Import recent runs.
    do_recent(Connection().tbpl)

    # Import options.days days of history.
    tzinfo = pytz.timezone("America/Los_Angeles")
    today = datetime.datetime.now(tzinfo)
    for i in range(options.days):
        do_date(today - datetime.timedelta(i), Connection().tbpl)

if __name__ == "__main__":
   main()
