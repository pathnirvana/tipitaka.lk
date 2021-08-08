# creating zip files for offline apps

# npm build and then use pkg to create binaries
npm run build
npx pkg -t win-x64,win-x86,macos,linux --out-path dist_desktop server/server.js

# create zip files
cp dist_desktop/server-win-x86.exe ./tipitaka-lk-windows.exe
./node_modules/.bin/node-pre-gyp install --directory=./node_modules/sqlite3 --target_platform=win32 --target_arch=ia32
cp node_modules/sqlite3/lib/binding/napi-v3-win32-ia32/node_sqlite3.node .
tar -a -c -f dist_desktop/tipitaka-lk-windows-32bit.zip dist server tipitaka-lk-windows.exe node_sqlite3.node
rm ./tipitaka-lk-windows.exe 
rm ./node_sqlite3.node
echo 'created windows-x86 zip'

cp dist_desktop/server-win-x64.exe ./tipitaka-lk-windows.exe
./node_modules/.bin/node-pre-gyp install --directory=./node_modules/sqlite3 --target_platform=win32
cp node_modules/sqlite3/lib/binding/napi-v3-win32-x64/node_sqlite3.node .
tar -a -c -f dist_desktop/tipitaka-lk-windows-64bit.zip dist server tipitaka-lk-windows.exe node_sqlite3.node
rm ./tipitaka-lk-windows.exe 
rm ./node_sqlite3.node
echo 'created windows-x64 zip'

cp dist_desktop/server-macos-x64 ./tipitaka-lk-macos
./node_modules/.bin/node-pre-gyp install --directory=./node_modules/sqlite3 --target_platform=darwin
cp node_modules/sqlite3/lib/binding/napi-v3-darwin-x64/node_sqlite3.node .
tar -a -c -f dist_desktop/tipitaka-lk-macos.zip dist server tipitaka-lk-macos node_sqlite3.node
rm ./tipitaka-lk-macos
rm ./node_sqlite3.node
echo 'created macos zip'

cp dist_desktop/server-linux-x64 ./tipitaka-lk-linux
./node_modules/.bin/node-pre-gyp install --directory=./node_modules/sqlite3 --target_platform=linux
cp node_modules/sqlite3/lib/binding/napi-v3-linux-x64/node_sqlite3.node .
tar -a -c -f dist_desktop/tipitaka-lk-linux.zip dist server tipitaka-lk-linux node_sqlite3.node
rm ./tipitaka-lk-linux
rm ./node_sqlite3.node
echo 'created linux zip'