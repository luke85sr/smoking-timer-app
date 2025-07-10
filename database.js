import * as SQLite from 'expo-sqlite';
const db = SQLite.openDatabase('smoking_timer.db');

export function runSql(sql, params = []) {
  console.log('runSql CHIAMATO:', sql, params);
  return new Promise((resolve, reject) => {
    try {
      db.transaction(tx => {
        tx.executeSql(
          sql,
          params,
          (_, result) => {
            console.log('runSql SUCCESS:', sql, result);
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
            console.error('runSql ERROR:', sql, error);
            reject(error);
            return false;
          }
        );
      });
    } catch (err) {
      console.error('runSql TRANSACTION ERROR:', sql, err);
      reject(err);
    }
  });
}
