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
import * as Notifications from 'expo-notifications';

// --- COSTANTI DI TIMER E INCREMENTO ---
const BASE_SECONDS = 40 * 60;           // 40 minuti
const INCREMENT_DAYS = 5;               // ogni 5 giorni
const INCREMENT_SECONDS = 10 * 60;      // +10 minuti

// CONTENUTI MOTIVAZIONALI
const items = [
  { type: 'phrase', text: 'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type: 'benefit', text: 'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type: 'action', text: 'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type: 'link', text: '🔥 Hit motivazionale: https://youtu.be/z986ekPOo3M?si=YfM4vzkVYqTOJnYa', url: 'https://youtu.be/z986ekPOo3M?si=YfM4vzkVYqTOJnYa' },
  { type: 'link', text: '🎵 Musica live: https://www.youtube.com/live/dnpRUk2be84?si=7Ny79yyf7WpFeo-C', url: 'https://www.youtube.com/live/dnpRUk2be84?si=7Ny79yyf7WpFeo-C' },
  { type: 'phrase', text: 'Ogni sigaretta non fumata è un regalo ai tuoi polmoni 🫁' },
];

// CONFIGURO LE NOTIFICHE IN PRIMO PIANO
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- COMPONENTE ISTRUZIONI ---
function InstructionsScreen({ onDone }) {
  return (
    <ScrollView contentContainerStyle={styles.instructionsContainer}>
      <Text style={styles.instructionsTitle}>USO E FUNZIONAMENTO</Text>
      <Text style={styles.instructionsText}>
        L'applicazione ti aiuterà ad allungare il tempo di attesa tra una sigaretta e l'altra.
        {'\n\n'}
        Dopo aver impostato i dati iniziali clicca “STO FUMANDO” all'accensione della sigaretta,
        vedrai un timer di 40 minuti di base (aumenterà di 10 minuti ogni 5 giorni di uso).
        {'\n\n'}
        Al termine del timer riceverai una notifica: potrai fumare nuovamente.
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

// --- COMPONENTE IMPOSTAZIONI ---
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
      firstUse: Date.now()
    });
  };

  return (
    <View style={styles.settingsContainer}>
      <Text style={styles.settingsTitle}>Impostazioni iniziali</Text>
      <TextInput style={styles.input} placeholder="Il tuo nome" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Sigarette al giorno" keyboardType="numeric" value={cigsDay} onChangeText={setCigsDay} />
      <TextInput style={styles.input} placeholder="Prezzo pacchetto (€)" keyboardType="decimal-pad" value={packPrice} onChangeText={setPackPrice} />
      <TouchableOpacity style={styles.settingsButton} onPress={handleSave}>
        <Text style={styles.settingsButtonText}>Salva impostazioni</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [seenInstructions, setSeenInstructions] = useState(false);
  const [settings, setSettings] = useState(null);

  const [remaining, setRemaining] = useState(BASE_SECONDS);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  const [motivation, setMotivation] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({});

  const systemColor = Appearance.getColorScheme();
  const [manualDark, setManualDark] = useState(false);
  const isDark = manualDark || systemColor === 'dark';

  // --- EFFECT: SPLASH + CHIEDO PERMESSO NOTIFICA ---
  useEffect(() => {
    (async () => {
      setTimeout(() => setLoading(false), 2000);
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') Alert.alert("Serve il permesso per inviare notifiche");
    })();
  }, []);

  // --- EFFECT: CARICO STATO SALVATO ---
  useEffect(() => {
    (async () => {
      const si = await AsyncStorage.getItem('seenInstructions');
      const js = await AsyncStorage.getItem('appSettings');
      const hist = await AsyncStorage.getItem('history');
      const tr = await AsyncStorage.getItem('timerRunning');
      const ts = await AsyncStorage.getItem('timerStart');
      if (si === 'true') setSeenInstructions(true);
      if (js) setSettings(JSON.parse(js));
      if (hist) setHistory(JSON.parse(hist));
      if (tr === 'true') setRunning(true);
      if (ts) {
        const start = parseInt(ts, 10);
        // ricalcolo remaining
        const now = Math.floor((Date.now() - start) / 1000);
        const total = getCurrentPause(settings);
        const rem = total - now;
        setRemaining(rem > 0 ? rem : 0);
        if (rem <= 0) {
          scheduleEndNotification();
          setRunning(false);
        }
      }
    })();
  }, [settings]);

  // --- EFFECT: PERSISTER STATO ---
  useEffect(() => {
    if (settings) AsyncStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    AsyncStorage.setItem('history', JSON.stringify(history));
    const sums = {};
    history.forEach(e => sums[e.date] = (sums[e.date]||0)+1);
    setSummary(sums);
  }, [history]);

  // --- EFFECT: GESTIONE TIMER IN BACKGROUND ---
  useEffect(() => {
    if (running) {
      const total = getCurrentPause(settings);
      AsyncStorage.setItem('timerStart', Date.now().toString());
      AsyncStorage.setItem('timerRunning', 'true');
      timerRef.current = setInterval(async () => {
        const start = parseInt(await AsyncStorage.getItem('timerStart')||'0',10);
        const elapsed = Math.floor((Date.now()-start)/1000);
        const rem = total - elapsed;
        if (rem <= 0) {
          clearInterval(timerRef.current);
          setRunning(false);
          setRemaining(0);
          await AsyncStorage.setItem('timerRunning','false');
          scheduleEndNotification();
        } else {
          setRemaining(rem);
        }
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [running, settings]);

  // --- HANDLER NOTIFICHE ---
  const scheduleEndNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ È ora di fumare!",
        body: "Puoi fumare ora.",
        sound: true
      },
      trigger: null,
    });
  };

  // --- HANDLER VARI ---
  const handleDoneInstructions = async () => {
    await AsyncStorage.setItem('seenInstructions','true');
    setSeenInstructions(true);
  };
  const handleSaveSettings = obj => {
    setSettings(obj);
  };
  const handleSmoke = () => {
    // pick random
    const it = items[Math.floor(Math.random()*items.length)];
    setMotivation(it);
    // history
    const now = new Date();
    setHistory([{
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString().slice(0,5),
      cost: (settings.packPrice / 20)
    },...history]);
    // start timer
    setRemaining(getCurrentPause(settings));
    setRunning(true);
  };
  const handleReset = () => {
    Alert.alert('Reset app','Vuoi resettare tutto?',[
      { text:'Annulla' },
      { text:'Resetta', style:'destructive', onPress: async()=>{
        await AsyncStorage.multiRemove(['seenInstructions','appSettings','history','timerStart','timerRunning']);
        setSeenInstructions(false);
        setSettings(null);
        setHistory([]);
        setRunning(false);
        setRemaining(BASE_SECONDS);
      }}
    ]);
  };

  // RENDER SPLASH / ISTRUZIONI / SETTINGS
  if (loading) return (
    <LinearGradient colors={['#A8E6CF','#FFFFFF','#D0F0FD']} style={styles.splash}>
      <ActivityIndicator size="large" color="#004d40" />
      <Text style={styles.splashText}>Smoking Timer</Text>
    </LinearGradient>
  );
  if (!seenInstructions) return <InstructionsScreen onDone={handleDoneInstructions} />;
  if (!settings) return <SettingsScreen onSave={handleSaveSettings} />;

  // formatta timer
  const mm = String(Math.floor(remaining/60)).padStart(2,'0');
  const ss = String(remaining%60).padStart(2,'0');
  const timerText = `${mm}:${ss}`;

  return (
    <LinearGradient
      colors={isDark?['#000','#000']:['#A8E6CF','#FFFFFF','#D0F0FD']}
      style={[styles.container,{ paddingTop:100 }]}
    >
      <View style={styles.topBar}>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel,isDark&&styles.darkText]}>🌙</Text>
          <Switch value={isDark} onValueChange={setManualDark} />
        </View>
        <TouchableOpacity onPress={handleReset}>
          <Text style={[styles.resetText,isDark&&styles.darkText]}>RESET</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.timer,isDark?styles.timerDark:styles.timerLight]}>
        {timerText}
      </Text>
      <TouchableOpacity
        style={[styles.button,isDark?styles.buttonDark:styles.buttonLight]}
        onPress={()=>running?setRunning(false):handleSmoke()}
      >
        <Text style={styles.buttonText}>
          {running?'FERMA ⏸':'STO FUMANDO 🚬'}
        </Text>
      </TouchableOpacity>

      {motivation && motivation.type==='link' && (
        <Text style={styles.link} onPress={()=>Linking.openURL(motivation.url)}>
          {motivation.text}
        </Text>
      )}
      {motivation && motivation.type!=='link' && (
        <Text style={styles.motivation}>{motivation.text}</Text>
      )}

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

// --- FUNZIONE UTILE PER CALCOLARE IL PAUSE CURRENTE ---
function getCurrentPause(settings) {
  const first = settings.firstUse || Date.now();
  const days = Math.floor((Date.now() - first)/(1000*60*60*24));
  const steps = Math.floor(days / INCREMENT_DAYS);
  return BASE_SECONDS + steps * INCREMENT_SECONDS;
}

const styles = StyleSheet.create({
  splash:{flex:1,justifyContent:'center',alignItems:'center'},
  splashText:{marginTop:20,fontSize:28,fontWeight:'bold',color:'#004d40'},

  container:{flex:1,paddingHorizontal:16},
  topBar:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  switchRow:{flexDirection:'row',alignItems:'center'},
  switchLabel:{fontSize:20,marginRight:4},
  resetText:{color:'#c00',fontWeight:'bold'},
  darkText:{color:'#0f0'},

  timer:{fontSize:48,textAlign:'center',marginVertical:8},
  timerLight:{color:'#004d40'},
  timerDark:{color:'#00FF00'},

  button:{padding:12,borderRadius:8,alignItems:'center',marginVertical:10},
  buttonLight:{backgroundColor:'#00796b'},
  buttonDark:{backgroundColor:'#004d40'},
  buttonText:{color:'#fff',fontSize:20,fontWeight:'bold'},

  motivation:{fontSize:18,fontStyle:'italic',textAlign:'center',marginVertical:8,color:'#f57f17'},
  link:{fontSize:18,textAlign:'center',marginVertical:8,color:'#0066cc',textDecorationLine:'underline'},

  section:{fontSize:20,fontWeight:'bold',marginTop:12,textAlign:'center',color:'#004d40'},
  historyContainer:{flex:1,marginVertical:4},
  entry:{borderBottomWidth:1,borderBottomColor:'#ccc',paddingVertical:4},
  entryText:{fontSize:16,color:'#333'},

  summaryContainer:{maxHeight:120,marginVertical:4},
  summaryText:{fontSize:18,marginVertical:2,color:'#333'},

  instructionsContainer:{padding:20},
  instructionsTitle:{fontSize:24,fontWeight:'bold',textAlign:'center',marginBottom:12},
  instructionsText:{fontSize:16,lineHeight:24},
  instructionsButton:{marginTop:20,backgroundColor:'#00796b',padding:12,borderRadius:6,alignSelf:'center'},
  instructionsButtonText:{color:'#fff',fontSize:18},

  settingsContainer:{padding:20},
  settingsTitle:{fontSize:22,fontWeight:'bold',marginBottom:12,textAlign:'center'},
  input:{borderWidth:1,borderColor:'#888',padding:8,borderRadius:4,marginVertical:6},
  settingsButton:{marginTop:12,backgroundColor:'#00796b',padding:10,borderRadius:6,alignItems:'center'},
  settingsButtonText:{color:'#fff',fontSize:16},
});
