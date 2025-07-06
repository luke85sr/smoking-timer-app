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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Linking       from 'expo-linking';

const TIMER_BASE_MINUTES = 40;          // partenza 40'
const INCREMENT_DAYS     = 5;           // ogni 5 giorni +10'
const INCREMENT_SECONDS  = 10 * 60;
const TIMER_BASE_SECONDS = TIMER_BASE_MINUTES * 60;
const DEFAULT_PACK_PRICE = 5.30;
const CIG_PER_PACK       = 20;          // costo sempre diviso 20

// contenuti motivazionali
const items = [
  { type: 'phrase', text: 'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type: 'benefit', text: 'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type: 'action', text: 'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type: 'link',   text: '🔥 Hit motivazionale live: https://youtu.be/z986ekPOo3M', url: 'https://youtu.be/z986ekPOo3M' },
  { type: 'link',   text: '🎵 Musica live del momento: https://www.youtube.com/live/dnpRUk2be84', url: 'https://www.youtube.com/live/dnpRUk2be84' },
  { type: 'phrase', text: 'Ogni sigaretta non fumata è un regalo ai tuoi polmoni 🫁' },
];

// istruzioni
function InstructionsScreen({ onDone }) {
  return (
    <View style={styles.fullWhiteBackground}>
      <ScrollView contentContainerStyle={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>USO E FUNZIONAMENTO</Text>
        <Text style={styles.instructionsText}>
          L'applicazione ti aiuterà ad allungare il tempo di attesa tra una sigaretta e l'altra.
          {'\n\n'}
          Dopo aver impostato i dati iniziali clicca “STO FUMANDO” all'accensione della sigaretta,
          vedrai un timer di 40 minuti di base, questo si allungherà di 10 minuti ogni {INCREMENT_DAYS} giorni.
          {'\n\n'}
          Al termine del timer riceverai una notifica e potrai fumare di nuovo.
          {'\n\n'}
          Troverai un report quotidiano ed uno totale che ti segnalerà giorno per giorno i miglioramenti.
          {'\n\n'}
          Buona fortuna e dacci dentro, CI RIUSCIRAI!
        </Text>
        <TouchableOpacity style={styles.instructionsButton} onPress={onDone}>
          <Text style={styles.instructionsButtonText}>Ho capito, continua</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// impostazioni
function SettingsScreen({ onSave }) {
  const [name,      setName]      = useState('');
  const [cigsDay,   setCigsDay]   = useState('');
  const [packPrice, setPackPrice] = useState('');

  const handleSave = () => {
    if (!name || !cigsDay || !packPrice) {
      Alert.alert('Attenzione', 'Compila tutti i campi prima di continuare.');
      return;
    }
    onSave({
      name,
      cigsPerDay: parseInt(cigsDay, 10),
      packPrice:  parseFloat(packPrice.replace(',', '.')),
      startDate:  Date.now(),
    });
  };

  return (
    <View style={styles.fullWhiteBackground}>
      <ScrollView contentContainerStyle={styles.settingsContainer}>
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
      </ScrollView>
    </View>
  );
}

export default function App() {
  // stato splash
  const [loading, setLoading]               = useState(true);
  // viste iniziali
  const [seenInstructions, setSeenInstructions] = useState(false);
  const [settings,         setSettings]         = useState(null);
  // timer & storico
  const [remaining,  setRemaining]  = useState(TIMER_BASE_SECONDS);
  const [running,    setRunning]    = useState(false);
  const timerRef                      = useRef(null);
  const [motivation, setMotivation]  = useState(null);
  const [history,    setHistory]     = useState([]);
  const [summary,    setSummary]     = useState({});
  // dark mode toggle
  const systemColor                   = Appearance.getColorScheme();
  const [manualDark, setManualDark]   = useState(false);
  const isDark                        = manualDark || systemColor === 'dark';

  // --- EFFECT: splash 4s + richiesta permessi notifiche
  useEffect(() => {
    Notifications.requestPermissionsAsync();
    setTimeout(() => setLoading(false), 4000);
  }, []);

  // --- EFFECT: caricamento iniziale
  useEffect(() => {
    (async () => {
      const si   = await AsyncStorage.getItem('seenInstructions');
      const js   = await AsyncStorage.getItem('appSettings');
      const hist = await AsyncStorage.getItem('history');
      const ts   = await AsyncStorage.getItem('timerStart');
      const run  = await AsyncStorage.getItem('timerRunning');

      setSeenInstructions(si === 'true');
      if (js) setSettings(JSON.parse(js));
      if (hist) setHistory(JSON.parse(hist));

      if (run === 'true' && ts) {
        // ri-calcola remaining
        const elapsed = Math.floor((Date.now() - parseInt(ts,10)) / 1000);
        const incDays = Math.floor((Date.now() - (settings?.startDate||0)) / (1000*60*60*24)) ;
        const extra   = Math.floor(incDays / INCREMENT_DAYS) * INCREMENT_SECONDS;
        const total   = TIMER_BASE_SECONDS + extra;
        const rem     = total - elapsed;
        if (rem > 0) {
          setRemaining(rem);
          setRunning(true);
        }
      }
    })();
  }, []);

  // --- EFFECT: persistenza settings e storico e summary
  useEffect(() => {
    if (settings) AsyncStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    AsyncStorage.setItem('history', JSON.stringify(history));
    const sums = {};
    history.forEach(e => { sums[e.date] = (sums[e.date]||0) + 1 });
    setSummary(sums);
  }, [history]);

  // --- EFFECT: countdown + notifica
  useEffect(() => {
    if (running) {
      AsyncStorage.setItem('timerStart', Date.now().toString());
      AsyncStorage.setItem('timerRunning','true');

      timerRef.current = setInterval(async () => {
        const start   = parseInt(await AsyncStorage.getItem('timerStart')||'0', 10);
        const elapsed = Math.floor((Date.now() - start)/1000);
        const incDays = Math.floor((Date.now() - (settings?.startDate||0)) / (1000*60*60*24));
        const extra   = Math.floor(incDays / INCREMENT_DAYS) * INCREMENT_SECONDS;
        const total   = TIMER_BASE_SECONDS + extra;
        const rem     = total - elapsed;

        if (rem <= 0) {
          clearInterval(timerRef.current);
          setRunning(false);
          setRemaining(0);
          AsyncStorage.setItem('timerRunning','false');

          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⏰ Timer terminato!',
              body:  'Puoi fumare di nuovo.',
              sound: true,
            },
            trigger: null,
          });
        } else {
          setRemaining(rem);
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  // HANDLER
  const handleDoneInstructions = async () => {
    await AsyncStorage.setItem('seenInstructions','true');
    setSeenInstructions(true);
  };
  const handleSaveSettings = obj => setSettings(obj);

  const handleSmoke = () => {
    const it = items[Math.floor(Math.random()*items.length)];
    setMotivation(it);

    const now = new Date();
    setHistory([{
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString().slice(0,5),
      cost: DEFAULT_PACK_PRICE / CIG_PER_PACK
    }, ...history]);

    setRemaining(TIMER_BASE_SECONDS);
    setRunning(true);
  };

  const handleStop = () => {
    clearInterval(timerRef.current);
    setRunning(false);
    AsyncStorage.setItem('timerRunning','false');
  };

  const handleReset = async () => {
    Alert.alert('Reset app','Vuoi cancellare tutto?',[
      { text:'Annulla' },
      { text:'Resetta', style:'destructive', onPress: async () => {
        await AsyncStorage.multiRemove([
          'seenInstructions','appSettings','history','timerStart','timerRunning'
        ]);
        setSeenInstructions(false);
        setSettings(null);
        setHistory([]);
        setRunning(false);
        setRemaining(TIMER_BASE_SECONDS);
      }}]);
  };

  // se splash
  if (loading) {
    return (
      <LinearGradient colors={['#A8E6CF','#FFFFFF','#D0F0FD']} style={styles.splash}>
        <ActivityIndicator size="large" color="#004d40" />
        <Text style={styles.splashText}>Smoking Timer</Text>
      </LinearGradient>
    );
  }
  // istruzioni / settings
  if (!seenInstructions) return <InstructionsScreen onDone={handleDoneInstructions} />;
  if (!settings)        return <SettingsScreen     onSave={handleSaveSettings} />;

  // mm:ss
  const mm = String(Math.floor(remaining/60)).padStart(2,'0');
  const ss = String(remaining%60).padStart(2,'0');
  const timerText = `${mm}:${ss}`;

  return (
    <LinearGradient
      colors={isDark?['#000','#000']:['#A8E6CF','#FFFFFF','#D0F0FD']}
      style={styles.container}
    >
      {/* top bar */}
      <View style={styles.topBar}>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel,isDark&&styles.darkText]}>🌙</Text>
          <Switch value={isDark} onValueChange={setManualDark} />
        </View>
        <TouchableOpacity onPress={handleReset}>
          <Text style={[styles.resetText,isDark&&styles.darkText]}>RESET</Text>
        </TouchableOpacity>
      </View>

      {/* timer */}
      <Text style={[styles.timer,isDark?styles.timerDark:styles.timerLight]}>
        {timerText}
      </Text>

      {/* button */}
      {!running
        ? <TouchableOpacity style={[styles.button,isDark?styles.buttonDark:styles.buttonLight]} onPress={handleSmoke}>
            <Text style={styles.buttonText}>STO FUMANDO 🚬</Text>
          </TouchableOpacity>
        : <TouchableOpacity style={[styles.button,isDark?styles.buttonDark:styles.buttonLight]} onPress={handleStop}>
            <Text style={styles.buttonText}>FERMA ⏸</Text>
          </TouchableOpacity>
      }

      {/* motivazione */}
      {motivation && motivation.type==='link' && (
        <Text style={styles.link} onPress={()=>Linking.openURL(motivation.url)}>
          {motivation.text}
        </Text>
      )}
      {motivation && motivation.type!=='link' && (
        <Text style={styles.motivation}>{motivation.text}</Text>
      )}

      {/* dettaglio */}
      <Text style={[styles.section,isDark&&styles.darkText]}>🕒 Dettaglio fumo</Text>
      <FlatList
        style={styles.historyContainer}
        data={history}
        keyExtractor={(_,i)=>String(i)}
        renderItem={({item})=>(
          <View style={styles.entry}>
            <Text style={[styles.entryText,isDark&&styles.darkText]}>
              {item.date} {item.time} – €{item.cost.toFixed(2)}
            </Text>
          </View>
        )}
      />

      {/* riepilogo */}
      <Text style={[styles.section,isDark&&styles.darkText]}>📊 Riepilogo giornaliero</Text>
      <ScrollView style={styles.summaryContainer}>
        {Object.entries(summary).map(([day,c])=>(
          <Text key={day} style={[styles.summaryText,isDark&&styles.darkText]}>
            {day}: {c} sigarette
          </Text>
        ))}
      </ScrollView>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  splash:      { flex:1,justifyContent:'center',alignItems:'center' },
  splashText:  { marginTop:20,fontSize:28,fontWeight:'bold',color:'#004d40' },

  fullWhiteBackground: { flex:1, backgroundColor:'#fff' },

  instructionsContainer:{
    paddingTop:100, paddingHorizontal:20, paddingBottom:40
  },
  instructionsTitle:   { fontSize:24,fontWeight:'bold',textAlign:'center',marginBottom:12 },
  instructionsText:    { fontSize:16,lineHeight:24 },
  instructionsButton:  { marginTop:20,backgroundColor:'#00796b',padding:12,borderRadius:6,alignSelf:'center' },
  instructionsButtonText:{ color:'#fff',fontSize:18 },

  settingsContainer:{
    paddingTop:100, paddingHorizontal:20, paddingBottom:40
  },
  settingsTitle:       { fontSize:22,fontWeight:'bold',marginBottom:12,textAlign:'center' },
  input:               { borderWidth:1,borderColor:'#888',padding:8,borderRadius:4,marginVertical:6 },
  settingsButton:      { marginTop:12,backgroundColor:'#00796b',padding:10,borderRadius:6,alignItems:'center' },
  settingsButtonText:  { color:'#fff',fontSize:16 },

  container:           { flex:1,padding:16 },
  topBar:              { flexDirection:'row',justifyContent:'space-between',alignItems:'center' },
  switchRow:           { flexDirection:'row',alignItems:'center' },
  switchLabel:         { fontSize:20,marginRight:4 },
  resetText:           { color:'#c00',fontWeight:'bold' },
  darkText:            { color:'#0f0' },

  timer:               { fontSize:48,textAlign:'center',marginVertical:8 },
  timerLight:          { color:'#004d40' },
  timerDark:           { color:'#00FF00' },

  button:              { padding:12,borderRadius:8,alignItems:'center',marginVertical:10 },
  buttonLight:         { backgroundColor:'#00796b' },
  buttonDark:          { backgroundColor:'#004d40' },
  buttonText:          { color:'#fff',fontSize:20,fontWeight:'bold' },

  motivation:          { fontSize:18,fontStyle:'italic',textAlign:'center',marginVertical:8,color:'#f57f17' },
  link:                { fontSize:18,textAlign:'center',marginVertical:8,color:'#0066cc',textDecorationLine:'underline' },

  section:             { fontSize:20,fontWeight:'bold',marginTop:12,textAlign:'center',color:'#004d40' },
  historyContainer:    { flex:1,marginVertical:4 },
  entry:               { borderBottomWidth:1,borderBottomColor:'#ccc',paddingVertical:4 },
  entryText:           { fontSize:16,color:'#333' },

  summaryContainer:    { maxHeight:120,marginVertical:4 },
  summaryText:         { fontSize:18,marginVertical:2,color:'#333' },
});
