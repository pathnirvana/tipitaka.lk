import { IOS, iosDictVersion, iosFtsVersion, platform } from '../constants';

// Initialize variables to null. They will be assigned if the environment is correct.
let CapacitorSQLite = null;
let SQLiteConnection = null;

// Check if running in a browser environment and if the Capacitor global object is available.
if (typeof window !== 'undefined' && window.Capacitor) {
  try {
    // If in a Capacitor environment, attempt to require the sqlite plugin.
    const sqlitePlugin = require('@capacitor-community/sqlite');
    
    CapacitorSQLite = sqlitePlugin.CapacitorSQLite;
    SQLiteConnection = sqlitePlugin.SQLiteConnection;
  } catch (e) {
    console.warn('Capacitor SQLite plugin not available.', e);
  }
}

export async function copyDatabaseFiles() {
   let sqlite;
   if (platform === IOS) {
      try {
         sqlite = new SQLiteConnection(CapacitorSQLite);
         const storedIosDictVersion = localStorage.getItem('iosDictVersion');
         const storedIosFtsVersion = localStorage.getItem('iosFtsVersion');
         
         //Null check is for first time installations
         const dictNeedsUpdate = storedIosDictVersion === null || storedIosDictVersion !== iosDictVersion;
         const ftsNeedsUpdate = storedIosFtsVersion === null || storedIosFtsVersion !== iosFtsVersion;
         console.log('From local storage iosDictVersion: ', storedIosDictVersion);
         console.log('From local storage iosFtsVersion: ', storedIosFtsVersion);

         if (dictNeedsUpdate || ftsNeedsUpdate) {
            await sqlite.copyFromAssets();
            const result = await sqlite.getDatabaseList();
            localStorage.setItem('iosDictVersion', iosDictVersion);
            localStorage.setItem('iosFtsVersion', iosFtsVersion);

            console.log('Set local storage iosDictVersion: ', iosDictVersion);
            console.log('Set local storage iosFtsVersion: ', iosFtsVersion);
            console.log('Database list after copy:', result.values);
         } else {
            const result = await sqlite.getDatabaseList();
            console.log(`Database files already exists : ${result.values}`);
         }
      } catch (error) {
         console.error(`Error copying database files: ${error.message}`, error);
      } finally {
         if (sqlite) {
            await sqlite.closeAllConnections();
         }
      }
   }
   //Would be good to bring the Android operation here.
};