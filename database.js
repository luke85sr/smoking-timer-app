import SQLite from 'react-native-sqlite-storage';
const db = SQLite.openDatabase(
  { name: 'smoking_timer.db', location: 'default' }, // raccomandato da doc ufficiale
  () => console.log('[DB] Database opened!'),
  err => console.error('[DB] Open error:', err)
);

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
              const arr = [];
              for (let i = 0; i < result.rows.length; i++) {
                arr.push(result.rows.item(i));
              }
              resolve(arr);
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
