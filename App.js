import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import * as SQLite from 'expo-sqlite';

export default function App() {
  const [result, setResult] = useState('Waiting...');

  useEffect(() => {
    // 1. Apro il database
    const db = SQLite.openDatabase('test_minimal.db');

    // 2. Eseguo SQL base
    db.transaction(tx => {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY NOT NULL, value TEXT);'
      );
      tx.executeSql(
        'INSERT INTO test (value) VALUES (?)', 
        ['Hello SQLite!']
      );
      tx.executeSql(
        'SELECT * FROM test', 
        [], 
        (_, { rows }) => {
          setResult(JSON.stringify(rows._array));
        },
        (_, err) => {
          setResult('Errore: ' + err.message);
          return false;
        }
      );
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text>SQLite TEST:</Text>
      <Text>{result}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center' }
});
