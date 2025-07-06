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
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const TIMER_BASE = 40 * 60;            // partenza 40'
const INCREMENT_DAYS = 5;              // ogni 5 giorni
const INCREMENT_SECONDS = 10 * 60;     // +10'

const DEFAULT_PACK_PRICE = 5.30;
const DEFAULT_CIG_PER_PACK = 20;

const items = [
  { type: 'phrase', text: 'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type: 'benefit', text: 'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type: 'action', text: 'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type: 'link', text: '🔥 Hit motivazionale: https://youtu.be/z986ekPOo3M?si=YfM4vzkVYqTOJnYa', url: 'https://youtu.be/z986ekPOo3M?si=YfM4vzkVYqTOJnYa' },
  { type: 'link', text: '🎵 Musica live: https://www.youtube.com/live/dnpRUk2be84?si=7Ny79yyf7WpFeo-C', url: 'https://www.youtube.com/live/dnpRUk2be84?si=7Ny79yyf7WpFeo-C' },
  { type: 'phrase', text: 'Ogni sigaretta non fumata è un regalo ai tuoi polmoni 🫁' },
];

// --- Instructions Screen ---
function InstructionsScreen({ onDone }) {
  return (
    <ScrollView contentContainerStyle={styles.instructionsContainer}>
      <Text style={styles.instructionsTitle}>USO E FUNZIONAMENTO</Text>
      <Text style={styles.instructionsText}>
        L'applicazione ti aiuterà ad allungare il tempo di attesa tra una sigaretta e l'altra.
        {'\n\n'}
        Dopo aver impostato i dati iniziali clicca “STO FUMANDO” all'accensione della sigaretta,
        vedrai un timer di 40 minuti di base, questo si allungherà ogni 5 giorni di 10 minuti.
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

// --- Settings Screen ---
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

// --- Main App ---
export default function App() {
  const [loading, setLoading] = useState(true);
  const [seenInstructions, setSeenInstructions] = useState(false);
  const [settings, setSettings] = useState(null);

  const [remaining, setRemaining] = useState(TIMER_BASE);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  const [motivation, setMotivation] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({});

  const systemColor = Appearance.getColorScheme();
  const [manualDark, setManualDark] = useState(false);
  const isDark = manualDark || systemColor === 'dark';

  // -- Load persisted data --
  useEffect(() => {
    (async () => {
      const si = await AsyncStorage.getItem('seenInstructions');
      const js = await AsyncStorage.getItem('appSettings');
      const hist = await AsyncStorage.getItem('history');
      const runFlag = await AsyncStorage.getItem('running');
      const startTs = await AsyncStorage.getItem('timerStart');

      setSeenInstructions(si === 'true');
      if (js) setSettings(JSON.parse(js));
      if (hist) setHistory(JSON.parse(hist));

      if (runFlag === 'true' && startTs) {
        setRunning(true);
        // recalc remaining
        const elapsed = Math.floor((Date.now() - parseInt(startTs,10)) / 1000);
        const days = Math.floor(elapsed / (24*3600));
        const extra = Math.floor(days / INCREMENT_DAYS) * INCREMENT_SECONDS;
        const rem = TIMER_BASE + extra - elapsed;
        setRemaining(rem>0?rem:0);
      }
      setLoading(false);
    })();
  }, []);

  // -- Persist settings --
  useEffect(() => {
    if (settings) AsyncStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  // -- Persist history + summary --
  useEffect(() => {
    AsyncStorage.setItem('history', JSON.stringify(history));
    const sums = {};
    history.forEach(e => sums[e.date] = (sums[e.date]||0)+1);
    setSummary(sums);
  }, [history]);

  // -- Timer effect + notification --
  useEffect(() => {
    if (running) {
      const start = Date.now();
      AsyncStorage.setItem('timerStart', start.toString());
      AsyncStorage.setItem('running', 'true');

      timerRef.current = setInterval(async () => {
        const ts = parseInt(await AsyncStorage.getItem('timerStart'),10);
        const elapsed = Math.floor((Date.now() - ts)/1000);
        const days = Math.floor(elapsed/(24*3600));
        const extra = Math.floor(days/INCREMENT_DAYS)*INCREMENT_SECONDS;
        const total = TIMER_BASE + extra;
        const rem = total - elapsed;
        if (rem <= 0) {
          clearInterval(timerRef.current);
          setRunning(false);
          AsyncStorage.setItem('running','false');
          setRemaining(0);
          await Notifications.scheduleNotificationAsync({
            content: { title: "Timer finito!", body: "Puoi fumare di nuovo." },
            trigger: null
          });
        } else {
          setRemaining(rem);
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  // -- Handlers --
  const handleDoneInstructions = async () => {
    await AsyncStorage.setItem('seenInstructions','true');
    setSeenInstructions(true);
  };
  const handleSaveSettings = obj => setSettings(obj);

  const handleSmoke = async () => {
    const it = items[Math.floor(Math.random()*items.length)];
    setMotivation(it);

    const now = new Date();
    const cost = (settings?.packPrice||DEFAULT_PACK_PRICE) / DEFAULT_CIG_PER_PACK;
    const entry = {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString().slice(0,5),
      cost
    };
    const newHist = [entry, ...history];
    setHistory(newHist);
    await AsyncStorage.setItem('history', JSON.stringify(newHist));

    setRemaining(TIMER_BASE);
    setRunning(true);
  };

  const handleReset = async () => {
    Alert.alert('Reset app','Cancellare tutto?',[
      { text:'Annulla' },
      { text:'OK', style:'destructive', onPress: async ()=>{
        await AsyncStorage.multiRemove(['seenInstructions','appSettings','history','timerStart','running']);
        setSeenInstructions(false);
        setSettings(null);
        setHistory([]);
        setRunning(false);
        setRemaining(TIMER_BASE);
      }}
    ]);
  };

  // -- Format timer text --
  const mm = String(Math.floor(remaining/60)).padStart(2,'0');
  const ss = String(remaining%60).padStart(2,'0');
  const timerText = `${mm}:${ss}`;

  // -- Render logic --
  if (loading) {
    return (
      <LinearGradient colors={['#A8E6CF','#FFFFFF','#D0F0FD']} style={styles.splash}>
        <ActivityIndicator size="large" color="#004d40" />
        <Text style={styles.splashText}>Smoking Timer</Text>
      </LinearGradient>
    );
  }
  if (!seenInstructions) return <InstructionsScreen onDone={handleDoneInstructions} />;
  if (!settings)           return <SettingsScreen onSave={handleSaveSettings} />;

  return (
    <LinearGradient
      colors={isDark ? ['#000','#000'] : ['#A8E6CF','#FFFFFF','#D0F0FD']}
      style={styles.container}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel,isDark&&styles.darkText]}>🌙</Text>
          <Switch value={isDark} onValueChange={setManualDark}/>
        </View>
        <TouchableOpacity onPress={handleReset}>
          <Text style={[styles.resetText,isDark&&styles.darkText]}>RESET</Text>
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <Text style={[styles.timer,isDark?styles.timerDark:styles.timerLight]}>
        {timerText}
      </Text>

      {/* Buttons */}
      {!running ? (
        <TouchableOpacity
          style={[styles.button,isDark?styles.buttonDark:styles.buttonLight]}
          onPress={handleSmoke}
        >
          <Text style={styles.buttonText}>STO FUMANDO 🚬</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button,isDark?styles.buttonDark:styles.buttonLight]}
          onPress={()=>setRunning(false)}
        >
          <Text style={styles.buttonText}>FERMA ⏸</Text>
        </TouchableOpacity>
      )}

      {/* Motivazione */}
      {motivation && motivation.type==='link' ? (
        <Text style={styles.link} onPress={()=>Linking.openURL(motivation.url)}>
          {motivation.text}
        </Text>
      ) : motivation ? (
        <Text style={styles.motivation}>{motivation.text}</Text>
      ) : null}

      {/* Dettaglio */}
      <Text style={[styles.section,isDark&&styles.darkText]}>🕒 Dettaglio fumo</Text>
      <View style={styles.historyContainer}>
        <FlatList
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
      </View>

      {/* Riepilogo */}
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
  splash:{ flex:1,justifyContent:'center',alignItems:'center' },
  splashText:{ marginTop:20,fontSize:28,fontWeight:'bold',color:'#004d40' },

  container:{ flex:1,paddingTop:100,paddingHorizontal:16 },
  topBar:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center' },
  switchRow:{ flexDirection:'row',alignItems:'center' },
  switchLabel:{ fontSize:20,marginRight:4 },
  resetText:{ color:'#c00',fontWeight:'bold' },
  darkText:{ color:'#0f0' },

  timer:{ fontSize:48,textAlign:'center',marginVertical:8 },
  timerLight:{ color:'#004d40' },
  timerDark:{ color:'#00FF00' },

  button:{ padding:12,borderRadius:8,alignItems:'center',marginVertical:10 },
  buttonLight:{ backgroundColor:'#00796b' },
  buttonDark:{ backgroundColor:'#004d40' },
  buttonText:{ color:'#fff',fontSize:20,fontWeight:'bold' },

  motivation:{ fontSize:18,fontStyle:'italic',textAlign:'center',marginVertical:8,color:'#f57f17' },
  link:{ fontSize:18,textAlign:'center',marginVertical:8,color:'#0066cc',textDecorationLine:'underline' },

  section:{ fontSize:20,fontWeight:'bold',marginTop:12,textAlign:'center',color:'#004d40' },
  historyContainer:{ flex:1,marginVertical:4 },
  entry:{ borderBottomWidth:1,borderBottomColor:'#ccc',paddingVertical:4 },
  entryText:{ fontSize:16,color:'#333' },

  summaryContainer:{ maxHeight:120,marginVertical:4 },
  summaryText:{ fontSize:18,marginVertical:2,color:'#333' },

  instructionsContainer:{ padding:20 },
  instructionsTitle:{ fontSize:24,fontWeight:'bold',textAlign:'center',marginBottom:12 },
  instructionsText:{ fontSize:16,lineHeight:24 },
  instructionsButton:{ marginTop:20,backgroundColor:'#00796b',padding:12,borderRadius:6,alignSelf:'center' },
  instructionsButtonText:{ color:'#fff',fontSize:18 },

  settingsContainer:{ padding:20 },
  settingsTitle:{ fontSize:22,fontWeight:'bold',marginBottom:12,textAlign:'center' },
  input:{ borderWidth:1,borderColor:'#888',padding:8,borderRadius:4,marginVertical:6 },
  settingsButton:{ marginTop:12,backgroundColor:'#00796b',padding:10,borderRadius:6,alignItems:'center' },
  settingsButtonText:{ color:'#fff',fontSize:16 },
});
