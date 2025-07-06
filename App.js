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
  TextInput,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const DEFAULT_PACK_PRICE = 5.30;        // prezzo pacchetto di default
const DEFAULT_CIG_PER_PACK = 20;        // sigarette per pacchetto
const TIMER_SECONDS = 50 * 60;          // 50 minuti

// contenuti motivazionali
const items = [
  { type: 'phrase', text: 'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type: 'benefit', text: 'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type: 'action', text: 'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type: 'link', text: '🔥 Hit motivazionale: https://youtu.be/z986ekPOo3M', url: 'https://youtu.be/z986ekPOo3M' },
  { type: 'link', text: '🎵 Musica live: https://www.youtube.com/live/dnpRUk2be84', url: 'https://www.youtube.com/live/dnpRUk2be84' },
  { type: 'phrase', text: 'Ogni sigaretta non fumata è un regalo ai tuoi polmoni 🫁' },
];

// ISTRUZIONI
function InstructionsScreen({ onDone }) {
  return (
    <ScrollView contentContainerStyle={styles.instructionsContainer}>
      <Text style={styles.instructionsTitle}>USO E FUNZIONAMENTO</Text>
      <Text style={styles.instructionsText}>
        L'applicazione ti aiuterà ad allungare il tempo di attesa tra una sigaretta e l'altra.
        {'\n\n'}
        Dopo aver impostato i dati iniziali clicca “STO FUMANDO” all'accensione della sigaretta,
        vedrai un timer di 50 minuti di base, questo si allungherà nel tempo in modo da fumare meno.
        {'\n\n'}
        Al termine del timer potrai fumare nuovamente o allungare il tempo di pausa premendo “POSTICIPA DI 10 MINUTI”.
        {'\n\n'}
        Troverai un report quotidiano ed uno totale che ti segnalerà giorno per giorno i miglioramenti.
        {'\n\n'}
        Buona fortuna e dacci dentro, CI RIUSCIRAI!
      </Text>
      <TouchableOpacity style={styles.instructionsButton} onPress={onDone}>
        <Text style={styles.instructionsButtonText}>Ho capito, continua</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// IMPOSTAZIONI
function SettingsScreen({ onSave }) {
  const [name, setName] = useState('');
  const [cigsDay, setCigsDay] = useState('');
  const [packPrice, setPackPrice] = useState('');

  const handleSave = () => {
    if (!name || !cigsDay || !packPrice) {
      Alert.alert('Attenzione', 'Compila tutti i campi prima di continuare.');
      return;
    }
    onSave({
      name,
      cigsPerDay: parseInt(cigsDay, 10),
      packPrice: parseFloat(packPrice.replace(',', '.')),
    });
  };

  return (
    <View style={styles.settingsContainer}>
      <Text style={styles.settingsTitle}>Impostazioni iniziali</Text>
      <TextInput
        style={styles.input}
        placeholder="Il tuo nome"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Sigarette al giorno (es. 20)"
        keyboardType="numeric"
        value={cigsDay}
        onChangeText={setCigsDay}
      />
      <TextInput
        style={styles.input}
        placeholder="Prezzo pacchetto (€)"
        keyboardType="decimal-pad"
        value={packPrice}
        onChangeText={setPackPrice}
      />
      <TouchableOpacity style={styles.settingsButton} onPress={handleSave}>
        <Text style={styles.settingsButtonText}>Salva impostazioni</Text>
      </TouchableOpacity>
    </View>
  );
}

// APP PRINCIPALE
export default function App() {
  const [loading, setLoading] = useState(true);
  const [seenInstructions, setSeenInstructions] = useState(false);
  const [settings, setSettings] = useState(null);
  const [remaining, setRemaining] = useState(TIMER_SECONDS);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);
  const [motivation, setMotivation] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({});
  const systemColor = Appearance.getColorScheme();
  const [manualDark, setManualDark] = useState(false);
  const isDark = manualDark || systemColor === 'dark';

  // Splash 2s
  useEffect(() => {
    setTimeout(() => setLoading(false), 2000);
  }, []);

  // Caricamento iniziale
  useEffect(() => {
    (async () => {
      const si = await AsyncStorage.getItem('seenInstructions');
      const js = await AsyncStorage.getItem('appSettings');
      const hist = await AsyncStorage.getItem('history');
      setSeenInstructions(si === 'true');
      if (js) setSettings(JSON.parse(js));
      if (hist) setHistory(JSON.parse(hist));
    })();
  }, []);

  // Persiste settings e storico
  useEffect(() => {
    if (settings) AsyncStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    AsyncStorage.setItem('history', JSON.stringify(history));
    const sums = {};
    history.forEach(e => { sums[e.date] = (sums[e.date] || 0) + 1; });
    setSummary(sums);
  }, [history]);

  // Timer persistente
  useEffect(() => {
    if (running) {
      AsyncStorage.setItem('timerStart', Date.now().toString());
      timerRef.current = setInterval(async () => {
        const start = parseInt(await AsyncStorage.getItem('timerStart') || '0', 10);
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const rem = TIMER_SECONDS - elapsed;
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

  // Handlers
  const handleDoneInstructions = async () => {
    await AsyncStorage.setItem('seenInstructions', 'true');
    setSeenInstructions(true);
  };
  const handleSaveSettings = obj => setSettings(obj);
  const handleSmoke = () => {
    const it = items[Math.floor(Math.random() * items.length)];
    setMotivation(it);
    const now = new Date();
    setHistory([{
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString().slice(0, 5),
      cost: (settings?.packPrice ?? DEFAULT_PACK_PRICE) / DEFAULT_CIG_PER_PACK
    }, ...history]);
    setRemaining(TIMER_SECONDS);
    setRunning(true);
  };
  const handleReset = async () => {
    Alert.alert('Reset app', 'Vuoi cancellare tutte le impostazioni e storico?', [
      { text: 'Annulla' },
      { text: 'Resetta', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove(['seenInstructions','appSettings','history','timerStart']);
        setSeenInstructions(false);
        setSettings(null);
        setHistory([]);
        setRunning(false);
        setRemaining(TIMER_SECONDS);
      }}
    ]);
  };

  // Format timer
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const timerText = `${mm}:${ss}`;

  // Rendering
  if (loading) {
    return (
      <LinearGradient colors={['#A8E6CF','#FFFFFF','#D0F0FD']} style={styles.splash}>
        <ActivityIndicator size="large" color="#004d40" />
        <Text style={styles.splashText}>Smoking Timer</Text>
      </LinearGradient>
    );
  }
  if (!seenInstructions) return <InstructionsScreen onDone={handleDoneInstructions} />;
  if (!settings)       return <SettingsScreen   onSave={handleSaveSettings} />;

  return (
    <LinearGradient
      colors={isDark ? ['#000','#000'] : ['#A8E6CF','#FFFFFF','#D0F0FD']}
      style={styles.container}
    >
      <View style={styles.topBar}>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, isDark && styles.darkText]}>🌙</Text>
          <Switch value={isDark} onValueChange={setManualDark} />
        </View>
        <TouchableOpacity onPress={handleReset}>
          <Text style={[styles.resetText, isDark && styles.darkText]}>RESET</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.timer, isDark ? styles.timerDark : styles
