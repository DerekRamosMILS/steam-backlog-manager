#!/usr/bin/env bash
# Re-apply the space-in-path fix that `expo prebuild` keeps undoing.
#
# The generated ios/*.xcodeproj/project.pbxproj runs the React Native bundling
# script through backticks:
#
#     `"$NODE_BINARY" --print "...react-native-xcode.sh"`
#
# Node prints an absolute path; the backticks execute it unquoted, so any space
# in the project path splits it into separate words and the build dies with
# "No such file or directory".
#
# This lives outside node_modules, so patch-package cannot cover it, and
# prebuild regenerates the file. Run this after every `expo prebuild`.
#
# The permanent fix is a project path without spaces.
set -euo pipefail

PBXPROJ=$(find ios -name project.pbxproj -maxdepth 2 | head -1)
if [[ -z "$PBXPROJ" ]]; then
  echo "No ios/*.xcodeproj/project.pbxproj found. Run expo prebuild first." >&2
  exit 1
fi

python3 - "$PBXPROJ" <<'PY'
import io, sys
path = sys.argv[1]
s = io.open(path, encoding='utf-8').read()
old = ('`\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname('
       'require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\"`')
new = ('/bin/sh \\"$(\\"$NODE_BINARY\\" --print \\"require(\'path\').dirname('
       'require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'\\")\\"')
if new in s:
    print("already patched")
elif old in s:
    io.open(path, 'w', encoding='utf-8').write(s.replace(old, new))
    print("patched", path)
else:
    sys.exit("bundle script pattern not found — upstream template may have changed")
PY
