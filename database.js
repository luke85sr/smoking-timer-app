// database.js
import { openDatabase } from 'expo-sqlite';

// Apre (o crea) il DB
const db = openDatabase('smoking_timer.db');

/**
 * Esegue una query SQL:
 * - per SELECT restituisce Promise<array di righe>
 * - per INSERT/UPDATE/DELETE restituisce Promise<{ insertId, rowsAffected }>
 */
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
              insertId:     result.insertId,
              rowsAffected: result.rowsAffected,
            });
          }
        },
        (_, error) => {
          reject(error);
          return false;  // impedisce rollback automatico
        }
      );
    });
  });
}
