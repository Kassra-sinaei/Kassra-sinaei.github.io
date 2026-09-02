#!/usr/bin/env python3
"""Refresh the citation figure in index.html from Google Scholar.

Scholar has no API and blocks automated clients, so this is written to fail
closed: if the page cannot be fetched, does not look like the right profile,
or yields an implausible number, the file is left exactly as it is. A stale
figure is fine; a wrong or zeroed one is not.
"""
import re
import sys
import urllib.request

PROFILE = "XF-e8VAAAAAJ"
URL = f"https://scholar.google.com/citations?user={PROFILE}&hl=en"
PAGE = "index.html"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/122.0 Safari/537.36")


def fail(msg):
    print(f"no update: {msg}")
    sys.exit(0)          # a blocked fetch is not a build failure


def main():
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": UA,
                                                   "Accept-Language": "en-US,en;q=0.9"})
        html = urllib.request.urlopen(req, timeout=45).read().decode("utf-8", "replace")
    except Exception as e:
        fail(f"fetch failed ({e})")

    if re.search(r"captcha|unusual traffic|not a robot", html, re.I):
        fail("Scholar returned a challenge page")
    if PROFILE not in html and "gsc_prf_in" not in html:
        fail("response does not look like the profile page")

    m = re.search(r'<td class="gsc_rsb_std">(\d+)</td>', html)
    if not m:
        fail("citation table not found")
    found = int(m.group(1))
    if found <= 0 or found > 1_000_000:
        fail(f"implausible value {found}")

    page = open(PAGE, encoding="utf-8").read()
    cur = re.search(r'(<dd class="figure__n" id="citations" data-to=")(\d+)(">)(\d+)(</dd>)', page)
    if not cur:
        fail("citation figure not found in " + PAGE)

    current = int(cur.group(2))
    if current == found:
        print(f"unchanged: {found} citations")
        return

    # a large drop is far more likely to be a parsing accident than reality
    if found < current * 0.5:
        fail(f"refusing suspicious drop {current} -> {found}")

    page = page[:cur.start()] + f'{cur.group(1)}{found}{cur.group(3)}{found}{cur.group(5)}' + page[cur.end():]
    open(PAGE, "w", encoding="utf-8").write(page)
    print(f"updated: {current} -> {found} citations")


if __name__ == "__main__":
    main()
