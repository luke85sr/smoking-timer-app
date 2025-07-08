// database.js
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('smoking_timer.db');

export function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.transaction(tx =>
      tx.executeSql(
        sql,
        params,
        (_, resultSet) => resolve(resultSet),
        (_, error) => { reject(error); return false; }
      )
    );
  });
}
