import * as SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase({ name: 'smokingTimer.db' });

export const runSql = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.transaction(tx => {
      tx.executeSql(sql, params, (_, result) => resolve(result), (_, error) => reject(error));
    })
  );

// Crea la tabella se non esiste
runSql(`CREATE TABLE IF NOT EXISTS smoking_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  price TEXT
)`);
