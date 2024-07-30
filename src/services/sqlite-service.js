import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { IOS, dbFileNameDict, dbFileNameFts, platform } from '../constants';

export const querySqlite = async (type, sql) => {
   if (platform === IOS) {
      if (type === 'fts') {
         try {
            const sqliteFtsConn = new SQLiteConnection(CapacitorSQLite);
            const dbFts = await sqliteFtsConn.createConnection(dbFileNameFts, false, 'no-encryption', 1);

            await dbFts.open();
            console.log("query>> " + sql);
            const result = await dbFts.query(sql);
            await dbFts.close();
            await sqliteFtsConn.closeConnection(dbFileNameFts);
            return result.values;
         } catch (error) {
            console.error(`Error querying ${type} database: ${error.message}`, error);
            return null;
         }
      }
      else if (type === 'dict') {
         try {
            const sqliteDictConn = new SQLiteConnection(CapacitorSQLite);
            const dbDict = await sqliteDictConn.createConnection(dbFileNameDict, false, 'no-encryption', 1);

            await dbDict.open();
            console.log("query>> " + sql);
            const result = await dbDict.query(sql);
            await dbDict.close();
            await sqliteDictConn.closeConnection(dbFileNameDict);
            return result.values;
         } catch (error) {
            console.error(`Error querying ${type} database: ${error.message}`, error);
            return null;
         }
      }
   }
}

