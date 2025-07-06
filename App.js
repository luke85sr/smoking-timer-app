import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Appearance,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';

const PACK_PRICE = 5.30;          // € per pack
const CIG_PER_PACK = 20;
const COST_PER_CIG = PACK_PRICE / CIG_PER_PACK;

// mix of motivational content
const items = [
  { type: 'phrase', text: 'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type: 'benefit', text: 'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type: 'link', text: '🔥 Hit motivazionale: https://youtu.be/z986ekPOo3M?si=YfM4vzkVYqTOJnYa', url: 'https://youtu.be/z986ekPOo3M?si=YfM4vzkVYqTOJnYa' },
  { type: 'action', text: 'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type: 'link', text: '🎵 Musica live: https://www.youtube.com/live/dnpRUk2be84?si=7Ny79yyf7WpFeo-C', url: 'https://www.youtube.com/live/dnpRUk2be84?si=7Ny79yyf7WpFeo-C' },
  { type: 'action', text: 'Bevi un bicchiere d’acqua per distrarti 💧' },
  { type: 'benefit', text: 'Ogni giorno senza fumo il cuore ringrazia❤️' },
  { type: 'link', text: '🔥 Hit motivazionale: https://youtu.be/3JZ4pnNtyxQ', url: 'https://youtu.be/3JZ4pnNtyxQ' },
  { type: 'phrase', text: 'Ogni sigaretta non fumata è un regalo ai tuoi polmoni 🫁' },
];

export default function App() {
  // 1) splash
  const [loading, setLoading] = useState(true);
  // 2) timer
  const [remaining, setRemaining] = useState(50 * 60);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);
  // 3) current motivation
  const [motivation, setMotivation] = useState(null);
  // 4) history entries
  const [history, setHistory] = useState([]);
  // 5) daily summary map { date: count }
  const [summary, setSummary] = useState({});
  // dark mode
  const isDark = Appearance.getColorScheme() === 'dark';

  // Splash: show for 2s
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(t);
  }, []);

  // load history on mount
  useEffect(() => {
    AsyncStorage.getItem('history').then(json => {
      if (json) setHistory(JSON.parse(json));
    });
  }, []);

  // persist history + recalc summary whenever it changes
  useEffect(() => {
    AsyncStorage.setItem('history', JSON.stringify(history));
    const sums = {};
    history.forEach(entry => {
      sums[entry.date] = (sums[entry.date] || 0) + 1;
    });
    setSummary(sums);
  }, [history]);

  // timer effect (real-time even in background)
  useEffect(() => {
    if (running) {
      const start = Date.now() - ((50 * 60 - remaining) * 1000);
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const rem = 50 * 60 - elapsed;
        if (rem <= 0) {
          clearInterval(timerRef.current);
          setRunning(false);
          setRemaining(0);
        } else {
          setRemaining(rem);
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  // format mm:ss
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const timerText = `${mm}:${ss}`;

  // user taps “STO FUMANDO”
  const handleSmoke = () => {
    // pick random item
    const it = items[Math.floor(Math.random() * items.length)];
    setMotivation(it);
    // add history entry
    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString().slice(0, 5);
    setHistory([{ date, time, cost: COST_PER_CIG }, ...history]);
    // reset & start timer
    setRemaining(50 * 60);
    setRunning(true);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#A8E6CF', '#FFFFFF', '#D0F0FD']} style={styles.splash}>
        <ActivityIndicator size="large" color="#004d40" />
        <Text style={styles.splashText}>Smoking Timer</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={
        isDark
          ? ['#000000', '#000000', '#000000']
          : ['#A8E6CF', '#FFFFFF', '#D0F0FD']
      }
      style={styles.container}
    >
      {/* Timer */}
      <Text style={[styles.timer, isDark ? styles.timerDark : styles.timerLight]}>
        {timerText}
      </Text>
      <TouchableOpacity
        style={[styles.button, isDark ? styles.buttonDark : styles.buttonLight]}
        onPress={() => (running ? setRunning(false) : handleSmoke())}
      >
        <Text style={styles.buttonText}>
          {running ? 'FERMA ⏸' : 'STO FUMANDO 🚬'}
        </Text>
      </TouchableOpacity>

      {/* Motivation */}
      {motivation && motivation.type === 'link' && (
        <Text style={styles.link} onPress={() => Linking.openURL(motivation.url)}>
          {motivation.text}
        </Text>
      )}
      {motivation && motivation.type !== 'link' && (
        <Text style={styles.motivation}>{motivation.text}</Text>
      )}

      {/* Detailed history */}
      <Text style={[styles.section, isDark && styles.sectionDark]}>🕒 Dettaglio fumo</Text>
      <View style={styles.historyContainer}>
        <FlatList
          data={history}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={styles.entry}>
              <Text style={[styles.entryText, isDark && styles.entryTextDark]}>
                {item.date} {item.time} – €{item.cost.toFixed(2)}
              </Text>
            </View>
          )}
        />
      </View>

      {/* Daily summary */}
      <Text style={[styles.section, isDark && styles.sectionDark]}>📊 Riepilogo giornaliero</Text>
      <ScrollView style={styles.summaryContainer}>
        {Object.entries(summary).map(([day, count]) => (
          <Text
            key={day}
            style={[styles.summaryText, isDark && styles.summaryTextDark]}
          >
            {day}: {count} sigarette
          </Text>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, justifyContent: 'center', alignItems: 'center'
  },
  splashText: {
    marginTop: 20, fontSize: 28, fontWeight: 'bold', color: '#004d40'
  },
  container: {
    flex: 1, padding: 20
  },
  timer: {
    fontSize: 48, textAlign: 'center', marginVertical: 10
  },
  timerLight: { color: '#004d40' },
  timerDark: { color: '#00FF00' },
  button: {
    padding: 12, borderRadius: 8, marginVertical: 10, alignItems: 'center'
  },
  buttonLight: { backgroundColor: '#00796b' },
  buttonDark: { backgroundColor: '#004d40' },
  buttonText: {
    color: '#fff', fontSize: 20, fontWeight: 'bold'
  },
  motivation: {
    fontSize: 18, fontStyle: 'italic', textAlign: 'center', marginVertical: 8, color: '#f57f17'
  },
  link: {
    fontSize: 18, textAlign: 'center', marginVertical: 8, color: '#0066cc', textDecorationLine: 'underline'
  },
  section: {
    fontSize: 20, fontWeight: 'bold', marginTop: 15, textAlign: 'center', color: '#004d40'
  },
  sectionDark: {
    color: '#00FF00'
  },
  historyContainer: {
    flex: 1, marginVertical: 5
  },
  entry: {
    borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 4
  },
  entryText: {
    fontSize: 16, color: '#333'
  },
  entryTextDark: {
    color: '#00FF00'
  },
  summaryContainer: {
    maxHeight: 120, marginVertical: 5
  },
  summaryText: {
    fontSize: 18, marginVertical: 2, color: '#333'
  },
  summaryTextDark: {
    color: '#00FF00'
  },
});
