// App.js
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
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { runSql } from './database';

const DEFAULT_PACK_PRICE    = 5.30;
const DEFAULT_CIG_PER_PACK  = 20;
const TIMER_SECONDS_DEFAULT = 40 * 60;   // 40 minuti in secondi
const INCREMENT_DAYS        = 5;         // ogni 5 giorni
const INCREMENT_SECONDS     = 10 * 60;   // aggiunge 10 minuti in secondi

const items = [
  { type: 'phrase', text: 'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type: 'benefit', text: 'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type: 'action', text: 'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type: 'link',   text: '🔥 Hit motivazionale: https://youtu.be/z986ekPOo3M', url: 'https://youtu.be/z986ekPOo3M' },
  { type: 'link',   text: '🎵 Musica live: https://www.youtube.com/live/dnpRUk2be84', url: 'https://www.youtube.com/live/dnpRUk2be84' },
  { type: 'phrase', text: 'Ogni sigaretta non fumata è un regalo ai tuoi polmoni 🫁' },
];

// Gestione notifiche in primo piano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

// Pianifica notifica dopo `secondsFromNow` secondi
async function scheduleEndNotification(secondsFromNow) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Tempo finito!',
      body: 'Puoi fumare ora.',
    },
    trigger: { seconds: secondsFromNow, repeats: false },
  });
}

function InstructionsScreen({ onDone }) {
  return (
    <ScrollView contentContainerStyle={styles.instructionsContainer}>
      <Text style={styles.instructionsTitle}>USO E FUNZIONAMENTO</Text>
      <Text style={styles.instructionsText}>
        L'applicazione ti aiuterà ad allungare il tempo di attesa tra una sigaretta e l'altra.
        {'\n\n'}
        Dopo aver impostato i dati iniziali clicca “STO FUMANDO” all’accensione della sigaretta,
        vedrai un timer di base di 40 minuti che cresce di 10 min ogni 5 giorni di utilizzo.
        {'\n\n'}
        Troverai un report quotidiano e uno totale che ti segnalerà giorno per giorno i miglioramenti.
        {'\n\n'}
        Buona fortuna e dacci dentro, CI RIUSCIRAI!
      </Text>
      <TouchableOpacity style={styles.instructionsButton} onPress={onDone}>
        <Text style={styles.instructionsButtonText}>Ho capito, continua</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingsScreen({ onSave }) {
  const [name,     setName]      = useState('');
  const [cigsDay,  setCigsDay]   = useState('');
  const [packPrice,setPackPrice] = useState('');

  const handleSave = () => {
    if (!name || !cigsDay || !packPrice) {
      Alert.alert('Attenzione', 'Compila tutti i campi.');
      return;
    }
    onSave({
      name,
      cigsPerDay: parseInt(cigsDay, 10),
      packPrice: parseFloat(packPrice.replace(',', '.')),
      startDate: Date.now(),
    });
  };

  return (
    <View style={styles.settingsContainer}>
      <Text style={styles.settingsTitle}>Impostazioni iniziali</Text>
      <TextInput style={styles.input} placeholder="Il tuo nome" value={name} onChangeText={setName}/>
      <TextInput style={styles.input} placeholder="Sigarette al giorno" keyboardType="numeric" value={cigsDay} onChangeText={setCigsDay}/>
      <TextInput style={styles.input} placeholder="Prezzo pacchetto (€)" keyboardType="decimal-pad" value={packPrice} onChangeText={setPackPrice}/>
      <TouchableOpacity style={styles.settingsButton} onPress={handleSave}>
        <Text style={styles.settingsButtonText}>Salva</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [loading,         setLoading]          = useState(true);
  const [seenInstructions,setSeenInstructions] = useState(false);
  const [settings,        setSettings]         = useState(null);
  const [remaining,       setRemaining]        = useState(0);
  const [running,         setRunning]          = useState(false);
  const [motivation,      setMotivation]       = useState(null);
  const [history,         setHistory]          = useState([]);
  const [summary,         setSummary]          = useState({});
  const systemColor = Appearance.getColorScheme();
  const [manualDark,      setManualDark]       = useState(false);
  const isDark = manualDark || systemColor === 'dark';

  // 1) Chiedo permesso notifiche, poi inizializzo il DB e carico dati
  useEffect(() => {
    (async () => {
      // Richiesta permessi notifiche
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permessi notifiche negati',
          'Per ricevere gli avvisi di fine timer abilita le notifiche nelle impostazioni dell’app.'
        );
      }

      try {
        await runSql(`CREATE TABLE IF NOT EXISTS meta(
          key TEXT PRIMARY KEY, value TEXT
        )`);
        await runSql(`CREATE TABLE IF NOT EXISTS history(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT, time TEXT, cost REAL
        )`);

        // Leggi meta
        const metaResult = await runSql(`SELECT * FROM meta`);
        const metaArr    = metaResult.rows._array;
        const meta       = Object.fromEntries(metaArr.map(r => [r.key, r.value]));

        setSeenInstructions(meta.seenInstructions === 'true');

        if (meta.appSettings) {
          const s = JSON.parse(meta.appSettings);
          setSettings(s);

          // Calcola remaining
          const now            = Date.now();
          const elapsed        = Math.floor((now - (parseInt(meta.timerStart || now,10))) / 1000);
          const daysSinceStart = Math.floor((now - s.startDate) / (1000 * 60 * 60 * 24));
          const extra          = Math.floor(daysSinceStart / INCREMENT_DAYS) * INCREMENT_SECONDS;
          const total          = TIMER_SECONDS_DEFAULT + extra;

          setRemaining(Math.max(0, total - elapsed));
          setRunning(meta.running === 'true');
          if (meta.running === 'true') {
            scheduleEndNotification(Math.max(0, total - elapsed));
          }
        }

        // Storico e riepilogo
        const histResult = await runSql(`SELECT * FROM history ORDER BY id DESC`);
        const hist       = histResult.rows._array;
        setHistory(hist);
        setSummary(hist.reduce((acc, e) => {
          acc[e.date] = (acc[e.date] || 0) + 1;
          return acc;
        }, {}));

        setLoading(false);
      } catch (err) {
        console.error("DB init failed:", err);
        Alert.alert("Errore DB", "Impossibile inizializzare il database");
      }
    })();
  }, []);

  // 2) Salva impostazioni
  useEffect(() => {
    if (!settings) return;
    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['appSettings', JSON.stringify(settings)]);
    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['startDate', String(settings.startDate)]);
  }, [settings]);

  // 3) Salva stato timer
  useEffect(() => {
    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['running', running ? 'true' : 'false']);
    if (running) {
      const now = Date.now();
      runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['timerStart', String(now)]);
      scheduleEndNotification(remaining);
    }
  }, [running]);

  // 4) Fine istruzioni
  const handleDoneInstructions = async () => {
    await runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['seenInstructions', 'true']);
    setSeenInstructions(true);
  };

  // 5) “STO FUMANDO”
  const handleSmoke = () => {
    const it = items[Math.floor(Math.random() * items.length)];
    setMotivation(it);

    const now     = new Date();
    const isoDate = now.toISOString().slice(0,10);
    const time24  = now.toTimeString().slice(0,5);
    const cost    = settings.packPrice / DEFAULT_CIG_PER_PACK;

    runSql(`INSERT INTO history(date,time,cost) VALUES(?,?,?)`, [isoDate, time24, cost])
      .then(resultSet => {
        setHistory(prev => [
          { id: resultSet.insertId, date: isoDate, time: time24, cost },
          ...prev
        ]);
        setSummary(prev => ({
          ...prev,
          [isoDate]: (prev[isoDate] || 0) + 1
        }));
      })
      .catch(err => console.error("Error inserting smoke:", err));

    // Calcola nuovo totale con incremento giorni
    const daysUsed = Math.floor((Date.now() - settings.startDate) / (1000 * 60 * 60 * 24));
    const extra    = Math.floor(daysUsed / INCREMENT_DAYS) * INCREMENT_SECONDS;
    const totalSec = TIMER_SECONDS_DEFAULT + extra;

    setRemaining(totalSec);
    setRunning(true);
    scheduleEndNotification(totalSec);
  };

  // 6) Reset completo
  const handleReset = () => {
    Alert.alert('Reset','Cancellare tutto?',[ 
      { text:'No' },
      {
        text:'Sì', style:'destructive', onPress: async () => {
          await runSql(`DELETE FROM meta`);
          await runSql(`DELETE FROM history`);
          setSeenInstructions(false);
          setSettings(null);
          setHistory([]);
          setSummary({});
          setRunning(false);
          setRemaining(0);
        }
      }
    ]);
  };

  // Formatta timer MM:SS
  const mm = String(Math.floor(remaining/60)).padStart(2,'0');
  const ss = String(remaining % 60).padStart(2,'0');
  const timerText = `${mm}:${ss}`;

  // RENDER
  if (loading) {
    return (
      <LinearGradient colors={['#A8E6CF','#FFFFFF','#D0F0FD']} style={styles.splash}>
        <ActivityIndicator size="large" color="#004d40"/>
        <Text style={styles.splashText}>Smoking Timer</Text>
      </LinearGradient>
    );
  }
  if (!seenInstructions) {
    return <InstructionsScreen onDone={handleDoneInstructions}/>;
  }
  if (!settings) {
    return <SettingsScreen onSave={setSettings}/>;
  }

  return (
    <LinearGradient
      colors={isDark ? ['#000','#000'] : ['#A8E6CF','#FFFFFF','#D0F0FD']}
      style={styles.container}
    >
      <View style={styles.topBar}>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, isDark && styles.darkText]}>🌙</Text>
          <Switch value={isDark} onValueChange={setManualDark}/>
        </View>
        <TouchableOpacity onPress={handleReset}>
          <Text style={[styles.resetText, isDark && styles.darkText]}>RESET</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.timer, isDark ? styles.timerDark : styles.timerLight]}>
        {timerText}
      </Text>

      {!running && (
        <TouchableOpacity
          style={[styles.button, isDark ? styles.buttonDark : styles.buttonLight]}
          onPress={handleSmoke}
        >
          <Text style={styles.buttonText}>STO FUMANDO 🚬</Text>
        </TouchableOpacity>
      )}

      {motivation && motivation.type === 'link' && (
        <Text style={styles.link} onPress={() => Linking.openURL(motivation.url)}>
          {motivation.text}
        </Text>
      )}
      {motivation && motivation.type !== 'link' && (
        <Text style={styles.motivation}>{motivation.text}</Text>
      )}

      <Text style={[styles.section, isDark && styles.darkText]}>
        🕒 Dettaglio fumo
      </Text>
      <View style={styles.historyContainer}>
        <FlatList
          data={history}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <View style={styles.entry}>
              <Text style={[styles.entryText, isDark && styles.darkText]}>
                {item.date} {item.time} – €{item.cost.toFixed(2)}
              </Text>
            </View>
          )}
        />
      </View>

      <Text style={[styles.section, isDark && styles.darkText]}>
        📊 Riepilogo giornaliero
      </Text>
      <ScrollView style={styles.summaryContainer}>
        {Object.entries(summary).map(([day, c]) => (
          <Text key={day} style={[styles.summaryText, isDark && styles.darkText]}>
            {day}: {c} {c === 1 ? 'sigaretta' : 'sigarette'}
          </Text>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  splash:{ flex:1,justifyContent:'center',alignItems:'center' },
  splashText:{ marginTop:20,fontSize:28,fontWeight:'bold',color:'#004d40' },
  container:{ flex:1,padding:20 },
  topBar:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:20 },
  switchRow:{ flexDirection:'row',alignItems:'center' },
  switchLabel:{ fontSize:20,marginRight:4 },
  resetText:{ color:'#c00',fontWeight:'bold' },
  darkText:{ color:'#0f0' },
  timer:{ fontSize:48,textAlign:'center',marginVertical:10 },
  timerLight:{ color:'#004d40' },
  timerDark:{ color:'#00FF00' },
  button:{ padding:12,borderRadius:8,marginVertical:10,alignItems:'center' },
  buttonLight:{ backgroundColor:'#00796b' },
  buttonDark:{ backgroundColor:'#004d40' },
  buttonText:{ color:'#fff',fontSize:20,fontWeight:'bold' },
  motivation:{ fontSize:18,fontStyle:'italic',textAlign:'center',marginVertical:8,color:'#f57f17' },
  link:{ fontSize:18,textAlign:'center',marginVertical:8,color:'#0066cc',textDecorationLine:'underline' },
  section:{ fontSize:20,fontWeight:'bold',marginTop:15,textAlign:'center',color:'#004d40' },
  historyContainer:{ flex:1,marginVertical:5 },
  entry:{ borderBottomWidth:1,borderBottomColor:'#ccc',paddingVertical:4 },
  entryText:{ fontSize:16,color:'#333' },
  summaryContainer:{ maxHeight:120,marginVertical:5 },
  summaryText:{ fontSize:18,marginVertical:2,color:'#333' },
  instructionsContainer:{ padding:20, paddingTop:100 },
  instructionsTitle:{ fontSize:24,fontWeight:'bold',textAlign:'center',marginBottom:12 },
  instructionsText:{ fontSize:16,lineHeight:24 },
  instructionsButton:{ marginTop:20,backgroundColor:'#00796b',padding:12,borderRadius:6,alignSelf:'center' },
  instructionsButtonText:{ color:'#fff',fontSize:18 },
  settingsContainer:{ padding:20, paddingTop:100 },
  settingsTitle:{ fontSize:22,fontWeight:'bold',marginBottom:12,textAlign:'center' },
  input:{ borderWidth:1,borderColor:'#888',padding:8,borderRadius:4,marginVertical:6 },
  settingsButton:{ marginTop:12,backgroundColor:'#00796b',padding:10,borderRadius:6,alignItems:'center' },
  settingsButtonText:{ color:'#fff',fontSize:16 },
});
