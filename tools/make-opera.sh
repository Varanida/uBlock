#!/usr/bin/env bash
#
# This script assumes a linux environment

echo "*** Varanida0.opera: Creating web store package"
echo "*** Varanida0.opera: Copying files"

DES=dist/build/Varanida0.opera
rm -rf $DES
mkdir -p $DES

echo "*** Varanida0.opera: browserifying"
rm -rf src/browserify-js/dist
mkdir src/browserify-js/dist
browserify src/js/browserify-js/background_uwallet.js -o src/browserify-js/dist/background_uwallet.js
browserify src/js/browserify-js/background_udatawallet.js -o src/browserify-js/dist/background_udatawallet.js

echo "*** Varanida0.opera: gulping"
mkdir src/gulp-dist
gulp

echo "*** Varanida0.opera: making assets"
bash ./tools/make-assets.sh $DES

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

echo "*** Varanida0.opera: removing unnecessary sources"
rm -rf $DES/js/browserify-js
rm -rf $DES/js/bundled
rm -rf $DES/css/bundled
rm -rf $DES/css/fonts/*/

echo "*** Varanida0.opera: concatenating content scripts"
cat $DES/js/vapi-usercss.js > /tmp/contentscript.js
echo >> /tmp/contentscript.js
grep -v "^'use strict';$" $DES/js/contentscript.js >> /tmp/contentscript.js
mv /tmp/contentscript.js $DES/js/contentscript.js
rm $DES/js/vapi-usercss.js

# Opera-specific
cp platform/opera/manifest.json $DES/
rm -r $DES/_locales/cv
rm -r $DES/_locales/hi
rm -r $DES/_locales/ka
rm -r $DES/_locales/kk
rm -r $DES/_locales/mr
rm -r $DES/_locales/ta

echo "*** Varanida0.opera: Generating meta..."
python tools/make-opera-meta.py $DES/

echo "*** Varanida0.opera: Package done."
