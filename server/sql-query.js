"use strict"
/**
 * Load sqlite dbs and serve queries coming to it
 * sqlite will run in either in node or in android - isAndroid flag and the imports have to be set manually
 */

const isAndroid = false
if (isAndroid) {
    const dbVersions = { // updated dbs need to be marked here for update in android side
        'my-23-vol': 1,
    };
    Android.initDbVersions(JSON.stringify(dbVersions));
    Android.openDb('static/db/dict-all.db'); // force download the big fts db at the beginning
}

let sqliteRootFolder = '';  // add extra base url in macos

// extending classes that query data should implement the parseRow() function
class SqliteDB {
    constructor(file, isWrite = false) {
        this.file = file;
        if (!isAndroid) {
            const sqlite3 = require('sqlite3');
            const path = require('path');
            this.mode = isWrite ? (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE) : sqlite3.OPEN_READONLY;
            this.db = new sqlite3.Database(path.join(sqliteRootFolder, file), this.mode, err => {
                if (err) {
                    console.error(`Failed to open ${file}. ${err.message}`);
                    throw err;
                }
            });
        } else {
            // need to copy the db from assets folder before it can be opened
            this.db = Android.openDb(file); // this will return version+filename
        }
    }
    static setRootFolder(folder) { // add extra base url in macos
        sqliteRootFolder = folder;
    }
    parseRow(row) { // should be overridden in subclasses 
        return row;
    }
    // gets the first result
    async loadOne(sql, params) {
        if (isAndroid) { // load one or all, both the same for Android
            return this.loadAll(sql, params);
        }
        const row = await this.getAsync(sql, params);
        return row ? [this.parseRow(row)] : [];
    }
    // gets all that matches
    async loadAll(sql, params) {
        const rows = await (isAndroid ? this.androidGet(sql, params) : this.allAsync(sql, params));
        return rows.map(row => this.parseRow(row));
    }
    androidGet(sql, params) {
        try {
            const jsonStr = Android.all(this.db, sql, params);
            return JSON.parse(jsonStr);
        } catch (err) {
            console.error(err);
            throw new Error("Please wait until database copy finished. Then search again.");
        }
    }

    async getAsync(sql, params) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error(`Sqlite Get Failed ${sql}. ${err.message}`);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
    async allAsync(sql, params) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, row) => {
                if (err) {
                    console.error(`Sqlite All Failed ${sql}. ${err.message}`);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }
    run(sql, params) {
        this.db.run(sql, params, err => {
            if (err) {
                console.error(`Executing sql ${sql} on db ${this.file} failed ${err.message}`);
            }
        })
    }
    close() {
        this.db.close((err) => {
            if (err) {
                console.error(`Closing db ${this.file} failed ${err.message}`);
            }
        }); 
    }
}

module.exports = SqliteDB;