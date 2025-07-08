// App.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Alert as RNAlert,
  AppState,
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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { runSql } from './database';

// Global JS error handler
ErrorUtils.setGlobalHandler((error, isFatal) => {
  RNAlert.alert(
    isFatal ? 'Errore fatale' : 'Errore',
    `${error.name}: ${error.message}\n\n${error.stack
      .split('\n')
      .slice(0, 5)
      .join('\n')}`,
    [{ text: 'OK' }]
  );
});

// Foreground notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldPlaySound: true,
    shouldShowBadge: false,
  }),
});

// Constants
const DEFAULT_PACK_PRICE    = 5.30;
const DEFAULT_CIG_PER_PACK  = 20;
const TIMER_SECONDS_DEFAULT = 40 * 60; // 40 minutes
const INCREMENT_DAYS        = 5;       // every 5 days
const INCREMENT_SECONDS     = 10 * 60; // +10 minutes

const items = [
  { type:'phrase',  text:'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type:'benefit', text:'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type:'action',  text:'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type:'link',    text:'🔥 Hit motivazionale: https://youtu.be/z986ekPOo3M', url:'https://youtu.be/z986ekPOo3M' },
  { type:'link',    text:'🎵 Musica live: https://www.youtube.com/live/dnpRUk2be84', url:'https://www.youtube.com/live/dnpRUk2be84' },
  { type:'phrase',  text:'Ogni sigaretta non fumata è un regalo ai tuoi polmoni 🫁' },
];

async function scheduleEndNotification(delaySec) {
  await Notifications.scheduleNotificationAsync({
    content: { title: '⏰ Tempo finito!', body: 'Puoi fumare ora.' },
    trigger: { seconds: delaySec, repeats: false },
  });
}

function InstructionsScreen({ onDone }) {
  return (
    <ScrollView contentContainerStyle={styles.instructionsContainer}>
      <Text style={styles.instructionsTitle}>USO E FUNZIONAMENTO</Text>
      <Text style={styles.instructionsText}>
        L'app ti aiuta ad allungare il tempo tra una sigaretta e l'altra.{'\n\n'}
        Dopo aver impostato i dati clicca “STO FUMANDO” all’accensione,
        vedrai un timer di base di 40′ che cresce di 10′ ogni 5 giorni.{'\n\n'}
        Troverai un report quotidiano e totale sui tuoi progressi.{'\n\n'}
        <Text style={{ fontWeight: 'bold' }}>
          N.b. lascia l'app in background se stai fumando. Alla chiusura l'app perderà la sessione in corso ma non i salvataggi dei tuoi report.
        </Text>
        {'\n\n'}Buona fortuna, CI RIUSCIRAI!
      </Text>
      <TouchableOpacity style={styles.instructionsButton} onPress={onDone}>
        <Text style={styles.instructionsButtonText}>Ho capito, continua</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingsScreen({ onSave }) {
  const [name,  setName]  = useState('');
  const [cigs,  setCigs]  = useState('');
  const [price, setPrice] = useState('');

  const handleSave = () => {
    if (!name || !cigs || !price) {
      RNAlert.alert('Attenzione','Compila tutti i campi.');
      return;
    }
    onSave({
      name,
      cigsPerDay: parseInt(cigs,10),
      packPrice:  parseFloat(price.replace(',', '.')),
      startDate:  Date.now(),
    });
  };

  return (
    <View style={styles.settingsContainer}>
      <Text style={styles.settingsTitle}>Impostazioni iniziali</Text>
      <TextInput style={styles.input} placeholder="Il tuo nome" value={name} onChangeText={setName}/>
      <TextInput style={styles.input} placeholder="Sigarette al giorno" keyboardType="numeric" value={cigs} onChangeText={setCigs}/>
      <TextInput style={styles.input} placeholder="Prezzo pacchetto (€)" keyboardType="decimal-pad" value={price} onChangeText={setPrice}/>
      <TouchableOpacity style={styles.settingsButton} onPress={handleSave}>
        <Text style={styles.settingsButtonText}>Salva</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [loading,          setLoading]          = useState(true);
  const [seenInstructions, setSeenInstructions] = useState(false);
  const [settings,         setSettings]         = useState(null);
  const [remaining,        setRemaining]        = useState(0);
  const [running,          setRunning]          = useState(false);
  const [motivation,       setMotivation]       = useState(null);
  const [history,          setHistory]          = useState([]);
  const [summary,          setSummary]          = useState({});
  const colorScheme = Appearance.getColorScheme();
  const [manualDark,      setManualDark]       = useState(false);
  const isDark = manualDark || colorScheme === 'dark';
  const appState = useRef(AppState.currentState);

  // Countdown in foreground
  useEffect(() => {
    let timer;
    if (running) {
      timer = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(timer); setRunning(false); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => timer && clearInterval(timer);
  }, [running]);

  // Recalc on resume
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        if (running) recalcRemaining();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [running]);

  async function recalcRemaining() {
    const res = await runSql(`SELECT value FROM meta WHERE key = ?`, ['timerEnd']);
    if (res.length) {
      const end = parseInt(res[0].value, 10);
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      setRunning(left > 0);
    }
  }

  // Init DB, load settings, session, history
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        RNAlert.alert('Permessi notifiche negati','Abilita le notifiche nelle impostazioni.');
      }
      try {
        await runSql(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)`);
        await runSql(`CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, time TEXT, cost REAL)`);

        const metaArr = await runSql(`SELECT * FROM meta`);
        // build meta without Object.fromEntries
        const meta = metaArr.reduce((o, row) => {
          o[row.key] = row.value;
          return o;
        }, {});

        if (meta.appSettings) setSettings(JSON.parse(meta.appSettings));
        setSeenInstructions(meta.seenInstructions === 'true');

        if (meta.timerEnd) {
          const end = parseInt(meta.timerEnd, 10);
          const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
          setRemaining(left);
          if (left > 0) {
            setRunning(meta.running === 'true');
            scheduleEndNotification(left);
          } else {
            setRunning(false);
          }
        }

        // load history and build summary via forEach
        const hist = await runSql(`SELECT * FROM history ORDER BY id DESC`);
        setHistory(hist);
        const sum = {};
        hist.forEach(e => {
          sum[e.date] = (sum[e.date] || 0) + 1;
        });
        setSummary(sum);

        setLoading(false);
      } catch (err) {
        console.error(err);
        RNAlert.alert('Errore DB','Impossibile inizializzare il database');
      }
    })();
  }, []);

  // Save settings
  useEffect(() => {
    if (!settings) return;
    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['appSettings', JSON.stringify(settings)]);
    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['startDate', String(settings.startDate)]);
  }, [settings]);

  // Save running flag
  useEffect(() => {
    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['running', running ? 'true' : 'false']);
  }, [running]);

  // Confirm instructions
  const handleDoneInstructions = () => {
    setSeenInstructions(true);
    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['seenInstructions', 'true'])
      .catch(console.warn);
  };

  // STO FUMANDO
  const handleSmoke = () => {
    const it = items[Math.floor(Math.random() * items.length)];
    setMotivation(it);

    const now      = Date.now();
    const isoDate  = new Date(now).toISOString().slice(0, 10);
    const time24   = new Date(now).toTimeString().slice(0, 5);
    const cost     = settings.packPrice / DEFAULT_CIG_PER_PACK;
    const daysUsed = Math.floor((now - settings.startDate) / (1000 * 60 * 60 * 24));
    const extra    = Math.floor(daysUsed / INCREMENT_DAYS) * INCREMENT_SECONDS;
    const totalSec = TIMER_SECONDS_DEFAULT + extra;
    const timerEnd = now + totalSec * 1000;

    runSql(`INSERT INTO history(date,time,cost) VALUES(?,?,?)`, [isoDate, time24, cost])
      .then(({ lastInsertRowId }) => {
        setHistory(prev => [{ id: lastInsertRowId, date: isoDate, time: time24, cost }, ...prev]);
        setSummary(prev => {
          const copy = { ...prev };
          copy[isoDate] = (copy[isoDate] || 0) + 1;
          return copy;
        });
      });

    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['timerEnd', String(timerEnd)]);
    runSql(`INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)`, ['running', 'true']);

    scheduleEndNotification(totalSec);
    setRemaining(totalSec);
    setRunning(true);
  };

  // Reset
  const handleReset = () => {
    RNAlert.alert('Reset','Cancellare tutto?',[
      { text: 'No' },
      { text: 'Sì', style: 'destructive', onPress: async () => {
        await runSql(`DELETE FROM meta`);
        await runSql(`DELETE FROM history`);
        setSeenInstructions(false);
        setSettings(null);
        setHistory([]);
        setSummary({});
        setRunning(false);
        setRemaining(0);
      }}
    ]);
  };

  // Format MM:SS
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const timerText = `${mm}:${ss}`;

  // Routing
  if (loading) {
    return (
      <LinearGradient colors={['#A8E6CF','#FFFFFF','#D0F0FD']} style={styles.splash}>
        <ActivityIndicator size="large" color="#004d40"/>
        <Text style={styles.splashText}>Smoking Timer</Text>
      </LinearGradient>
    );
  }
  if (!seenInstructions) return <InstructionsScreen onDone={handleDoneInstructions}/>;
  if (!settings) return <SettingsScreen onSave={setSettings}/>;


  // Main screen
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

      {motivation?.type === 'link' && (
        <Text style={styles.link} onPress={() => Linking.openURL(motivation.url)}>
          {motivation.text}
        </Text>
      )}
      {motivation?.type !== 'link' && motivation && (
        <Text style={styles.motivation}>{motivation.text}</Text>
      )}

      <Text style={[styles.section, isDark && styles.darkText]}>🕒 Dettaglio fumo</Text>
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

      <Text style={[styles.section, isDark && styles.darkText]}>📊 Riepilogo giornaliero</Text>
      <ScrollView style={styles.summaryContainer}>
        {Object.keys(summary).map(day => (
          <Text key={day} style={[styles.summaryText, isDark && styles.darkText]}>
            {day}: {summary[day]} {summary[day] === 1 ? 'sigaretta' : 'sigarette'}
          </Text>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  splash:               { flex:1,justifyContent:'center',alignItems:'center' },
  splashText:           { marginTop:20,fontSize:28,fontWeight:'bold',color:'#004d40' },
  container:            { flex:1,padding:20 },
  topBar:               { flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:20 },
  switchRow:            { flexDirection:'row',alignItems:'center' },
  switchLabel:          { fontSize:20,marginRight:4 },
  resetText:            { color:'#c00',fontWeight:'bold' },
  darkText:             { color:'#0f0' },
  timer:                { fontSize:48,textAlign:'center',marginVertical:10 },
  timerLight:           { color:'#004d40' },
  timerDark:            { color:'#00FF00' },
  button:               { padding:12,borderRadius:8,marginVertical:10,alignItems:'center' },
  buttonLight:          { backgroundColor:'#00796b' },
  buttonDark:           { backgroundColor:'#004d40' },
  buttonText:           { color:'#fff',fontSize:20,fontWeight:'bold' },
  motivation:           { fontSize:18,fontStyle:'italic',textAlign:'center',marginVertical:8,color:'#f57f17' },
  link:                 { fontSize:18,textAlign:'center',marginVertical:8,color:'#0066cc',textDecorationLine:'underline' },
  section:              { fontSize:20,fontWeight:'bold',marginTop:15,textAlign:'center',color:'#004d40' },
  historyContainer:     { flex:1,marginVertical:5 },
  entry:                { borderBottomWidth:1,borderBottomColor:'#ccc',paddingVertical:4 },
  entryText:            { fontSize:16,color:'#333' },
  summaryContainer:     { maxHeight:120,marginVertical:5 },
  summaryText:          { fontSize:18,marginVertical:2,color:'#333' },
  instructionsContainer:{ padding:20,paddingTop:100 },
  instructionsTitle:    { fontSize:24,fontWeight:'bold',textAlign:'center',marginBottom:12 },
  instructionsText:     { fontSize:16,lineHeight:24,textAlign:'center' },
  instructionsButton:   { marginTop:20,backgroundColor:'#00796b',padding:12,borderRadius:6,alignSelf:'center' },
  instructionsButtonText:{ color:'#fff',fontSize:18 },
  settingsContainer:    { padding:20,paddingTop:100 },
  settingsTitle:        { fontSize:22,fontWeight:'bold',marginBottom:12,textAlign:'center' },
  input:                { borderWidth:1,borderColor:'#888',padding:8,borderRadius:4,marginVertical:6 },
  settingsButton:       { marginTop:12,backgroundColor:'#00796b',padding:10,borderRadius:6,alignItems:'center' },
  settingsButtonText:   { color:'#fff',fontSize:16 },
});
