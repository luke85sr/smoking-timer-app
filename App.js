// App.js
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as SQLite from 'expo-sqlite';

export default function App() {
  const [result, setResult] = useState('Inizializzo DB...');

  useEffect(() => {
    try {
      const db = SQLite.openDatabase('test_crash.db');
      db.transaction(tx => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY NOT NULL, txt TEXT);',
          [],
          () => {
            tx.executeSql(
              'INSERT INTO test (txt) VALUES (?)',
              ['CIAO DAL DB!'],
              () => {
                tx.executeSql('SELECT * FROM test;', [], (_, { rows }) => {
                  setResult('DB OK! Riga: ' + JSON.stringify(rows._array));
                });
              }
            );
          },
          (tx, error) => {
            setResult('Errore creazione DB: ' + error.message);
            return true;
          }
        );
      });
    } catch (e) {
      setResult('Errore: ' + e.message);
    }
  }, []);

  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <Text style={{ fontSize:24, color:'blue', textAlign:'center' }}>
        {result}
      </Text>
    </View>
  );
}
