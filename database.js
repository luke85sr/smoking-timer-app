import * as SQLite from 'expo-sqlite';
const db = SQLite.openDatabase('smoking_timer.db');

export function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        sql,
        params,
        (_, result) => {
          const verb = sql.trim().split(/\s+/)[0].toUpperCase();
          if (verb === 'SELECT') {
            resolve(result.rows._array);
          } else {
            resolve({
              insertId: result.insertId,
              rowsAffected: result.rowsAffected,
            });
          }
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}
