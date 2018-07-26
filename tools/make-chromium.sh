#!/usr/bin/env bash
#
# This script assumes a linux environment

echo "*** Varanida0.chromium: Creating web store package"
echo "*** Varanida0.chromium: Copying files"

DES=dist/build/Varanida0.chromium
rm -rf $DES
mkdir -p $DES

echo "*** Varanida0.chromium: browserifying"
rm -rf src/browserify-js/dist
mkdir src/browserify-js
mkdir src/browserify-js/dist
browserify src/js/browserify-js/background_uwallet.js -o src/browserify-js/dist/background_uwallet.js
browserify src/js/browserify-js/background_udatawallet.js -o src/browserify-js/dist/background_udatawallet.js

echo "*** Varanida0.chromium: gulping"
mkdir src/gulp-dist
if [ "$1" = all ]; then
  gulp --clean 1
else
  gulp
fi

echo "*** Varanida0.chromium: making assets"
bash ./tools/make-assets.sh $DES

echo "*** Varanida0.chromium: copying"
cp -R src/css                      $DES/
cp -R src/config                   $DES/
cp -R src/img                      $DES/
cp -R src/js                       $DES/
cp -R src/lib                      $DES/
cp -R src/_locales                 $DES/
cp src/*.html                      $DES/
cp platform/chromium/*.js          $DES/js/
cp src/browserify-js/dist/*.js     $DES/js/
cp src/gulp-dist/dist/js/*.js      $DES/js/
cp src/gulp-dist/dist/css/*.css    $DES/css/
cp src/gulp-dist/dist/css/fonts/*  $DES/css/fonts/
cp -R platform/chromium/img        $DES/
cp platform/chromium/*.html        $DES/
cp platform/chromium/*.json        $DES/
cp LICENSE.txt                     $DES/

echo "*** Varanida0.chromium: removing unnecessary sources"
rm -rf $DES/js/browserify-js
rm -rf $DES/js/bundled
rm -rf $DES/css/bundled
rm -rf $DES/css/fonts/*/


echo "*** Varanida0.chromium: concatenating content scripts"
cat $DES/js/vapi-usercss.js > /tmp/contentscript.js
echo >> /tmp/contentscript.js
grep -v "^'use strict';$" $DES/js/contentscript.js >> /tmp/contentscript.js
mv /tmp/contentscript.js $DES/js/contentscript.js
rm $DES/js/vapi-usercss.js

# Chrome store-specific
cp -R $DES/_locales/nb      $DES/_locales/no

echo "*** Varanida0.chromium: Generating meta..."
python tools/make-chromium-meta.py $DES/

if [ "$1" = all ]; then
    echo "*** Varanida0.chromium: Creating package..."
    pushd $(dirname $DES/) > /dev/null
    zip Varanida0.chromium.zip -qr $(basename $DES/)/*
    popd > /dev/null
fi

echo "*** Varanida0.chromium: Package done."
