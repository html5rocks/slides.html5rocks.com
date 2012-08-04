#!/bin/bash
#
# Builds the app cache manifest for the slides and deploys the app to prod.
# 
# Note: This script should be used in place of using appcfg.py update directly
# to update the application on App Engine.
#
# Copyright 2011 Eric Bidelman <ericbidelman@chromium.org>

python build_manifest.py
appcfg.py update ../ --no_cookies
