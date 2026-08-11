import { IOS, dbFileNameDict, dbFileNameFts, platform } from '../constants';

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

// Connection cache
const connections = {
  sqliteConn: null,
  fts: null,
  dict: null
};

// Database configuration mapping
const dbConfig = {
  fts: dbFileNameFts,
  dict: dbFileNameDict
};

const initializeConnection = async (type) => {
  // Initialize main SQLite connection if not exists
  if (!connections.sqliteConn) {
    connections.sqliteConn = new SQLiteConnection(CapacitorSQLite);
  }
  
  // Initialize specific connection if not exists
  if (!connections[type]) {
    connections[type] = await connections.sqliteConn.createConnection(
      dbConfig[type], 
      false, 
      'no-encryption', 
      1
    );
    await connections[type].open();
  }
};

export const querySqlite = async (type, sql) => {
   if (platform === IOS) {
      try {
         await initializeConnection(type);
    
         console.log("query>> " + sql);
         const result = await connections[type].query(sql);
    
         return result.values;
      } catch (error) {
         console.error(`Error querying ${type} database: ${error.message}`, error);
         return null;
      }
   }
}

// Close a specific database connection
const closeConnection = async (type) => {
  if (connections[type]) {
    try {
      // First close the database itself
      await connections[type].close();
      
      // Then close the connection through SQLiteConnection
      if (connections.sqliteConn) {
        await connections.sqliteConn.closeConnection(dbConfig[type]);
      }
      
      // Clear the reference
      connections[type] = null;
      console.log(`${type} database connection closed`);
    } catch (error) {
      console.error(`Error closing ${type} database:`, error);
    }
  }
};

// Close all database connections
const closeAllConnections = async () => {
  const types = Object.keys(dbConfig);
  
  for (const type of types) {
    await closeConnection(type);
  }
  
  // Reset the main connection
  connections.sqliteConn = null;
  console.log('All database connections closed');
};

// Cleanup function for app shutdown/component unmount
export const cleanup = async () => {
  await closeAllConnections();
};

