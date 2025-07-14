import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Appearance, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { runSql } from '../database';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';

const BASE_TIMER_SECONDS = 40 * 60;
const INCREMENT_SECONDS = 10 * 60;
const INCREMENT_DAYS = 5;
const MS_IN_A_DAY = 86400000;

const motivationalItems = [
  { type: 'phrase', text: 'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type: 'benefit', text: 'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type: 'action', text: 'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type: 'link', text: '🔥 Hit motivazionale live: https://youtube.com/live/5qap5aO4i9A', url: 'https://youtube.com/live/5qap5aO4i9A' },
  // Aggiungi altri motivatori qui se vuoi
];

export default function MainScreen({ onReset }) {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [motivation, setMotivation] = useState(null);
  const [report, setReport] = useState([]);
  const theme = Appearance.getColorScheme();
  const appState = useRef(AppState.currentState);

  const colors = theme === 'dark'
    ? ['#121212', '#121212', '#121212']
    : ['#A8E6CF', '#FFFFFF', '#A0CED9'];

  useEffect(() => {
    loadSession();
    fetchReport();
  }, []);

  useEffect(() => {
    let timer;
    if (running) {
      timer = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(timer);
            clearSession();
            setRunning(false);
            setMotivation(null);
            fetchReport();
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => timer && clearInterval(timer);
  }, [running]);

  const loadSession = async () => {
    const startTime = await AsyncStorage.getItem('@startTime');
    const duration = await AsyncStorage.getItem('@duration');
    if (startTime && duration) {
      const elapsed = (Date.now() - parseInt(startTime)) / 1000;
      const timeLeft = parseInt(duration) - elapsed;
      if (timeLeft > 0) {
        setRemaining(timeLeft);
        setRunning(true);
        const sessionCount = parseInt(await AsyncStorage.getItem('@sessionCount')) || 0;
        setMotivation(motivationalItems[sessionCount % motivationalItems.length]);

        // Ripristina notifica se non presente
        const endTimestamp = parseInt(startTime) + parseInt(duration) * 1000;
        await scheduleNotification(endTimestamp);
      } else {
        await clearSession();
      }
    }
  };

  const fetchReport = async () => {
    const data = await runSql('SELECT * FROM smoking_history ORDER BY date DESC');
    setReport(data.rows._array);
  };

  const startSession = async () => {
    const daysSinceEpoch = Math.floor(Date.now() / MS_IN_A_DAY);
    const increments = Math.floor(daysSinceEpoch / INCREMENT_DAYS);
    const duration = BASE_TIMER_SECONDS + increments * INCREMENT_SECONDS;
    const startTime = Date.now();

    const packPrice = await AsyncStorage.getItem('@packPrice');
    const pricePerCig = (parseFloat(packPrice) / 20).toFixed(2);
    await runSql('INSERT INTO smoking_history (date, price) VALUES (?, ?)', [new Date().toISOString(), pricePerCig]);

    const sessionCount = (parseInt(await AsyncStorage.getItem('@sessionCount')) || 0) + 1;
    setMotivation(motivationalItems[sessionCount % motivationalItems.length]);

    await AsyncStorage.multiSet([
      ['@startTime', String(startTime)],
      ['@duration', String(duration)],
      ['@sessionCount', String(sessionCount)]
    ]);

    await scheduleNotification(startTime + duration * 1000);
    setRemaining(duration);
    setRunning(true);
    fetchReport();
  };

  const scheduleNotification = async (endTimestamp) => {
    await notifee.cancelAllNotifications();
    await notifee.createChannel({
      id: 'smoking-timer-channel',
      name: 'Smoking Timer',
      importance: AndroidImportance.HIGH,
      sound: 'default'
    });
    await notifee.createTriggerNotification(
      {
        title: '⏰ Tempo finito!',
        body: 'Puoi fumare ora.',
        android: {
          channelId: 'smoking-timer-channel',
          pressAction: { id: 'default' },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: endTimestamp,
        alarmManager: true,
      }
    );
  };

  const clearSession = async () => {
    await AsyncStorage.multiRemove(['@startTime', '@duration']);
    await notifee.cancelAllNotifications();
  };

  const handleReset = async () => {
    await AsyncStorage.clear();
    await runSql('DELETE FROM smoking_history');
    await notifee.cancelAllNotifications();
    Alert.alert('Reset completato', 'Tutte le impostazioni e i dati sono stati cancellati.');
    onReset();
  };

  return (
    <LinearGradient colors={colors} style={styles.container}>
      <Text style={styles.title}>Benvenuto di nuovo!</Text>
      <Text style={styles.timer}>
        {Math.floor(remaining / 60)}:{('0' + Math.floor(remaining % 60)).slice(-2)}
      </Text>
      <TouchableOpacity style={styles.button} onPress={startSession}>
        <Text style={styles.buttonText}>STO FUMANDO</Text>
      </TouchableOpacity>
      {motivation && (
        <Text style={styles.motivation}>
          {motivation.type === 'link'
            ? <Text onPress={() => Linking.openURL(motivation.url)} style={styles.link}>{motivation.text}</Text>
            : motivation.text}
        </Text>
      )}
      <Text style={styles.subtitle}>Report giornaliero</Text>
      <FlatList
        data={report}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <Text style={styles.reportItem}>{item.date} - €{item.price}</Text>
        )}
      />
      <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetButtonText}>RESET APP</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', padding:100 },
  title: { fontSize:24, fontWeight:'bold', marginBottom:20, color:'#333' },
  timer: { fontSize:40, marginVertical:20, color:'#333' },
  button: { backgroundColor:'#2196F3', padding:15, borderRadius:8, marginBottom:20 },
  buttonText: { color:'#fff', fontSize:16, fontWeight:'bold' },
  motivation: { fontSize:16, textAlign:'center', marginVertical:10, color:'#333' },
  link: { color:'#1e90ff', textDecorationLine:'underline' },
  subtitle: { fontSize:18, fontWeight:'bold', marginTop:30, color:'#333' },
  reportItem: { fontSize:14, marginVertical:2, color:'#333' },
  resetButton: { backgroundColor:'#d32f2f', padding:10, borderRadius:8, marginTop:20 },
  resetButtonText: { color:'#fff', fontSize:14, fontWeight:'bold' }
});
