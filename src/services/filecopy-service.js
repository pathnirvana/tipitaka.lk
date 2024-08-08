import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { IOS, platform } from '../constants';

const iosDbVersions = {
   'dict': 1,
   'fts': 1
}

export async function copyDatabaseFiles() {
   let sqlite;
   if (platform === IOS) {
      try {
         sqlite = new SQLiteConnection(CapacitorSQLite);
         const result = await sqlite.getDatabaseList();
         console.log('Database list before copy:', result.values);

         if (!result.values || result.values.length === 0) {
            await sqlite.copyFromAssets();
            const result = await sqlite.getDatabaseList();
            console.log('Database list after copy:', result.values);
         } else {
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