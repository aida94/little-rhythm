#!/bin/sh
# Publish the app to GitHub Pages (https://aida94.github.io/little-rhythm/).
# Builds the app and pushes the dist folder to the gh-pages branch.
set -e
cd "$(dirname "$0")/.."
BASE_PATH=/little-rhythm/ npm run build
touch dist/.nojekyll
REMOTE=$(git remote get-url origin)
HELPER=$(git config --get-all credential.https://github.com.helper | tail -1)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy $(date '+%Y-%m-%d %H:%M')"
if [ -n "$HELPER" ]; then
  git -c credential.helper= -c "credential.helper=$HELPER" push -q -f "$REMOTE" gh-pages
else
  git push -q -f "$REMOTE" gh-pages
fi
rm -rf .git
echo "Published: https://aida94.github.io/little-rhythm/"
