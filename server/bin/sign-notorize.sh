#!/bin/bash

# Get the absolute path to the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Change the current working directory to the script's directory
cd "$SCRIPT_DIR"

# use to find the hash to codesign below
#security find-identity -v 

FILES=(
    #"tipitaka_lk_macos_intel"
    "tipitaka_lk_macos_m1m2"
)
FOLDER="tipitaka_lk_macos"

for FILE in "${FILES[@]}"
do
    codesign -s B9F140C9B821EFB37D751109B3593EB60A5F3C17 -o runtime -v $FILE
    
    # create a zip file or a dmg file containing the binary - otherwise notorization fails
    # dmg files can be stapled but not zip files - so use dmg below
    rm -rf $FOLDER && mkdir $FOLDER
    cp $FILE $FOLDER
    rm -rf $FILE.dmg
    hdiutil create -srcFolder $FOLDER -o $FILE.dmg

    xcrun notarytool submit --keychain-profile "janaka" --wait $FILE.dmg

    xcrun stapler staple $FILE.dmg

done