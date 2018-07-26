#!/usr/bin/env bash
#
# This script assumes a linux environment

echo "*** Varanida0.webext: Creating web store package"
echo "*** Varanida0.webext: Copying files"

DES=dist/build/Varanida0.webext
rm -rf $DES
mkdir -p $DES

echo "*** Varanida0.webext: browserifying"
rm -rf src/browserify-js/dist
mkdir src/browserify-js
mkdir src/browserify-js/dist
browserify src/js/browserify-js/background_uwallet.js -o src/browserify-js/dist/background_uwallet.js
# with source map
# browserify src/js/browserify-js/background_uwallet.js --debug | exorcist src/browserify-js/dist/background_uwallet.js.map > src/browserify-js/dist/background_uwallet.js
browserify src/js/browserify-js/background_udatawallet.js -o src/browserify-js/dist/background_udatawallet.js

echo "*** Varanida0.chromium: gulping"
mkdir src/gulp-dist
gulp

echo "*** Varanida0.webext: making assets"
bash ./tools/make-assets.sh $DES

cp -R src/css                           $DES/
cp -R src/config                        $DES/
cp -R src/img                           $DES/
cp -R src/js                            $DES/
cp -R src/lib                           $DES/
cp -R src/_locales                      $DES/
cp -R $DES/_locales/nb                  $DES/_locales/no
cp src/*.html                           $DES/
cp -R platform/chromium/img             $DES/
cp src/browserify-js/dist/*.js          $DES/js/
cp src/gulp-dist/dist/js/*.js           $DES/js/
cp src/gulp-dist/dist/css/*.css         $DES/css/
cp src/gulp-dist/dist/css/fonts/*       $DES/css/fonts/
cp platform/chromium/*.js               $DES/js/
cp platform/chromium/*.html             $DES/
cp platform/chromium/*.json             $DES/
cp LICENSE.txt                          $DES/

cp platform/webext/manifest.json        $DES/
cp platform/webext/polyfill.js          $DES/js/
cp platform/webext/vapi-webrequest.js   $DES/js/
cp platform/webext/vapi-cachestorage.js $DES/js/
cp platform/webext/vapi-usercss.js      $DES/js/


echo "*** Varanida0.webext: removing unnecessary scripts"
rm -rf $DES/js/browserify-js
rm -rf $DES/js/bundled
rm -rf $DES/css/bundled
rm -rf $DES/css/fonts/*/
rm $DES/img/.DS_Store
rm $DES/img/browsericons/.DS_Store

echo "*** Varanida0.webext: concatenating content scripts"
cat $DES/js/vapi-usercss.js > /tmp/contentscript.js
echo >> /tmp/contentscript.js
grep -v "^'use strict';$" $DES/js/contentscript.js >> /tmp/contentscript.js
mv /tmp/contentscript.js $DES/js/contentscript.js
rm $DES/js/vapi-usercss.js

# Webext-specific
rm $DES/options_ui.html
rm $DES/js/options_ui.js

echo "*** Varanida0.webext: Generating meta..."
python tools/make-webext-meta.py $DES/

if [ "$1" = all ]; then
    echo "*** Varanida0.webext: Creating package..."
    rm $DES.xpi
    pushd $DES > /dev/null
    zip ../$(basename $DES).xpi -qr *
    popd > /dev/null
fi

echo "*** Varanida0.webext: Package done."
