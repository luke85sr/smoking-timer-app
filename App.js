import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, FlatList, Linking, Animated, Keyboard, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';

const motivationalItems = [
  "💪 Non fumare ti fa risparmiare e migliora i polmoni!",
  "🎶 Ascolta questa playlist: https://youtu.be/5qap5aO4i9A",
  "🏃‍♂️ Fai una passeggiata per distrarti dal desiderio.",
  "🍏 Mangia uno snack salutare invece di accendere una sigaretta.",
  "🎨 Prova un hobby creativo per rilassarti.",
  "🎵 Playlist chill: https://youtu.be/5yx6BWlEVcY",
  "🚴‍♂️ Fai attività fisica leggera per scaricare la tensione.",
  "❤️ Riduci il rischio cardiovascolare smettendo di fumare."
];

export default function App() {
  const [name, setName] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [packPrice, setPackPrice] = useState('');
  const [smokesToday, setSmokesToday] = useState(0);
  const [spentToday, setSpentToday] = useState(0);
  const [timer, setTimer] = useState(2400); // 40 min
  const [pauseDuration, setPauseDuration] = useState(2400);
  const [darkMode, setDarkMode] = useState(false);
  const [motivation, setMotivation] = useState('');
  const [historicalData, setHistoricalData] = useState([]);
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useState(new Animated.Value(1))[0];
  const [firstSetupDone, setFirstSetupDone] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 2000, useNativeDriver: true }).start(() => setShowSplash(false));
    const loadData = async () => {
      try {
        const storedName = await AsyncStorage.getItem('name');
        const storedLimit = await AsyncStorage.getItem('dailyLimit');
        const storedPrice = await AsyncStorage.getItem('packPrice');
        const storedSmokes = await AsyncStorage.getItem('smokesToday');
        const storedSpent = await AsyncStorage.getItem('spentToday');
        const storedHistory = await AsyncStorage.getItem('historicalData');
        if (storedName && storedLimit && storedPrice) {
          setName(storedName);
          setDailyLimit(storedLimit);
          setPackPrice(storedPrice);
          setFirstSetupDone(true);
        }
        if (storedSmokes) setSmokesToday(parseInt(storedSmokes));
        if (storedSpent) setSpentToday(parseFloat(storedSpent));
        if (storedHistory) setHistoricalData(JSON.parse(storedHistory));
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (timer > 0) setTimer(prev => prev - 1);
      else if (timer === 0) sendNotification();
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const sendNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ È ora di fumare!",
        body: "Puoi fumare ora o posticipare di 10 minuti.",
      },
      trigger: null,
    });
  };

  const saveSettings = async () => {
    if (!name || !dailyLimit || !packPrice) {
      Alert.alert("Errore", "Compila tutti i campi.");
      return;
    }
    try {
      await AsyncStorage.setItem('name', name);
      await AsyncStorage.setItem('dailyLimit', dailyLimit);
      await AsyncStorage.setItem('packPrice', packPrice.replace(',', '.'));
      setFirstSetupDone(true);
      setTimer(pauseDuration);
      Keyboard.dismiss();
    } catch (e) {
      console.error(e);
    }
  };

  const resetApp = async () => {
    await AsyncStorage.clear();
    setName('');
    setDailyLimit('');
    setPackPrice('');
    setSmokesToday(0);
    setSpentToday(0);
    setHistoricalData([]);
    setFirstSetupDone(false);
  };

  const smoke = async () => {
    const newSmokes = smokesToday + 1;
    const pricePerCig = parseFloat(packPrice.replace(',', '.')) / 20;
    const newSpent = spentToday + pricePerCig;
    setSmokesToday(newSmokes);
    setSpentToday(newSpent);
    setMotivation(motivationalItems[Math.floor(Math.random() * motivationalItems.length)]);
    setTimer(pauseDuration);
    const today = new Date().toLocaleDateString();
    const updatedHistory = [...historicalData];
    const index = updatedHistory.findIndex(item => item.date === today);
    if (index >= 0) {
      updatedHistory[index].smokes = newSmokes;
      updatedHistory[index].spent = newSpent;
    } else {
      updatedHistory.push({ date: today, smokes: newSmokes, spent: newSpent });
    }
    setHistoricalData(updatedHistory);
    await AsyncStorage.setItem('smokesToday', newSmokes.toString());
    await AsyncStorage.setItem('spentToday', newSpent.toString());
    await AsyncStorage.setItem('historicalData', JSON.stringify(updatedHistory));
  };

  const postpone = () => setTimer(prev => prev + 600);
  const toggleDarkMode = () => setDarkMode(!darkMode);

  const renderMotivation = () => {
    if (motivation.includes('http')) {
      const url = motivation.match(/https?:\/\/\S+/)[0];
      return (
        <Text style={[styles.motivation, darkMode ? styles.linkDark : styles.link]} onPress={() => Linking.openURL(url)}>
          {motivation}
        </Text>
      );
    }
    return <Text style={styles.motivation}>{motivation}</Text>;
  };

  if (showSplash) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        <Text style={styles.splashText}>Smoking Timer</Text>
      </Animated.View>
    );
  }

  return (
    <LinearGradient
      colors={darkMode ? ['#000000', '#000000'] : ['#b2f7ef', '#ffffff', '#c0f0ff']}
      style={styles.container}
    >
      <Text style={[styles.title, darkMode && styles.titleDark]}>Smoking Timer</Text>
      <Switch value={darkMode} onValueChange={toggleDarkMode} />
      {!firstSetupDone ? (
        <View style={styles.setup}>
          <Text style={[styles.disclaimer, darkMode && styles.disclaimerDark]}>
            L'app non fa miracoli ma può aiutarti a diminuire le sigarette e risparmiare salute e soldi.
          </Text>
          <TextInput placeholder="Nome" value={name} onChangeText={setName} style={[styles.input, darkMode && styles.inputDark]} placeholderTextColor={darkMode ? '#00ffea' : '#888'} />
          <TextInput placeholder="Sigarette al giorno" value={dailyLimit} onChangeText={setDailyLimit} keyboardType="numeric" style={[styles.input, darkMode && styles.inputDark]} placeholderTextColor={darkMode ? '#00ffea' : '#888'} />
          <TextInput placeholder="Prezzo pacchetto (€)" value={packPrice} onChangeText={setPackPrice} keyboardType="decimal-pad" style={[styles.input, darkMode && styles.inputDark]} placeholderTextColor={darkMode ? '#00ffea' : '#888'} />
          <TouchableOpacity style={styles.button} onPress={saveSettings}><Text style={styles.buttonText}>Salva impostazioni</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.main}>
          <Text style={[styles.greeting, darkMode && styles.greetingDark]}>Ciao {name}!</Text>
          <Text style={styles.data}>Sigarette fumate oggi: {smokesToday} / {dailyLimit}</Text>
          <Text style={styles.data}>Spesa odierna: €{spentToday.toFixed(2)}</Text>
          <Text style={styles.data}>Prossima sigaretta fra: {Math.floor(timer / 60)}:{('0' + (timer % 60)).slice(-2)}</Text>
          <TouchableOpacity style={styles.button} onPress={smoke}><Text style={styles.buttonText}>Ho fumato una sigaretta 🚬</Text></TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={postpone}><Text style={styles.buttonText}>Posticipa di 10 minuti</Text></TouchableOpacity>
          {motivation ? renderMotivation() : null}
          <Text style={styles.historyTitle}>📊 Storico:</Text>
          <FlatList
            data={historicalData}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <Text style={styles.historyItem}>
                📅 {item.date} - 🚬 {item.smokes} - 💰 €{item.spent.toFixed(2)}
              </Text>
            )}
          />
          <TouchableOpacity style={styles.resetButton} onPress={resetApp}><Text style={styles.buttonText}>Reset App</Text></TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  splashContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#b2f7ef' },
  splashText: { fontSize: 40, fontWeight: 'bold', color: '#004d40' },
  title: { fontSize: 34, fontWeight: 'bold', textAlign: 'center', color: '#004d40', marginVertical: 10 },
  titleDark: { color: '#00ffea' },
  disclaimer: { fontSize: 22, textAlign: 'center', marginVertical: 20, color: '#333' },
  disclaimerDark: { color: '#00ffea' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 14, marginVertical: 8, fontSize: 20, color: '#000' },
  inputDark: { color: '#00ffea', borderColor: '#00ffea' },
  main: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  greeting: { fontSize: 32, marginVertical: 15, textAlign: 'center', color: '#333' },
  greetingDark: { color: '#00ffea' },
  data: { fontSize: 24, marginVertical: 8, textAlign: 'center', color: '#333' },
  button: { backgroundColor: '#00796b', padding: 15, borderRadius: 8, marginVertical: 12 },
  buttonText: { color: '#fff', fontSize: 20 },
  resetButton: { backgroundColor: '#c62828', padding: 12, borderRadius: 8, marginVertical: 8 },
  motivation: { fontSize: 22, fontStyle: 'italic', marginTop: 15, color: '#f57f17', textAlign: 'center' },
  link: { color: 'blue', textDecorationLine: 'underline' },
  linkDark: { color: '#00ffea', textDecorationLine: 'underline' },
  historyTitle: { fontSize: 26, marginTop: 20, fontWeight: 'bold', textAlign: 'center' },
  historyItem: { fontSize: 20, marginVertical: 3, textAlign: 'center' },
});


