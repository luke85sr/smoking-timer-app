import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Appearance,
  Keyboard
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';

const PACK_PRICE = 5.30;
const CIG_PER_PACK = 20;
const COST_PER_CIG = PACK_PRICE / CIG_PER_PACK;

const items = [
  { type: 'phrase', text: 'Sei più forte di una sigaretta. Ogni respiro è un passo verso la salute!' },
  { type: 'benefit', text: 'In 48h senza fumo, olfatto e gusto migliorano sensibilmente.' },
  { type: 'action', text: 'Fai 5 minuti di stretching per scaricare la tensione 🤸' },
  { type: 'action', text: 'Bevi un bicchiere d’acqua per distrarti 💧' },
  { type: 'benefit', text: 'Ogni giorno senza fumo il cuore ringrazia ❤️' },
  { type: 'benefit', text: 'Riduci il rischio di malattie cardiovascolari.' },
  { type: 'link',  text: '🎵 Live chill stream: https://youtu.be/5qap5aO4i9A', url: 'https://youtu.be/5qap5aO4i9A' },
  { type: 'link',  text: '🔥 Trending hits: https://youtu.be/z986ekPOo3M?si=YfM4vzkVYqTOJnYa', url: 'https://youtu.be/z986ekPOo3M?si=YfM4vzkVYqTOJnYa' },
  { type: 'link',  text: '🎶 Deep focus live: https://www.youtube.com/live/dnpRUk2be84?si=7Ny79yyf7WpFeo-C', url: 'https://www.youtube.com/live/dnpRUk2be84?si=7Ny79yyf7WpFeo-C' },
  { type: 'link',  text: '🎤 Motivational set: https://youtu.be/3JZ4pnNtyxQ', url: 'https://youtu.be/3JZ4pnNtyxQ' },
  { type: 'link',  text: '🎸 Rock live session: https://www.youtube.com/watch?v=fJ9rUzIMcZQ', url: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ' },
  { type: 'phrase', text: 'Ogni sigaretta non fumata è un regalo ai tuoi polmoni 🫁' },
  { type: 'phrase', text: 'Un piccolo sacrificio oggi, un grande guadagno domani.' },
];

function SplashScreen() {
  return (
    <LinearGradient colors={['#A8E6CF','#FFFFFF','#D0F0FD']} style={styles.splash}>
      <ActivityIndicator size="large" color="#004d40" />
      <Text style={styles.splashText} adjustsFontSizeToFit minimumFontScale={0.6}>
        Smoking Timer
      </Text>
    </LinearGradient>
  );
}

function InstructionsScreen({ onDone }) {
  return (
    <View style={styles.instructionsContainer}>
      <Text style={styles.instructionsTitle} adjustsFontSizeToFit minimumFontScale={0.6}>
        USO E FUNZIONAMENTO
      </Text>
      <ScrollView>
        <Text style={styles.instructionsText} adjustsFontSizeToFit minimumFontScale={0.6}>
          L'applicazione ti aiuterà ad allungare il tempo di attesa tra una sigaretta e l'altra.{'\n\n'}
          Dopo aver impostato i dati iniziali clicca “STO FUMANDO” all'accensione della sigaretta, vedrai un timer di 50 minuti di base, che si allungherà nel tempo in modo da fumare meno.{'\n\n'}
          Al termine del timer potrai fumare nuovamente o allungare il tempo di pausa premendo “POSTICIPA DI 10 MINUTI”.{'\n\n'}
          Troverai un report quotidiano ed uno totale che ti segnalerà giorno per giorno i miglioramenti.{'\n\n'}
          Buona fortuna e dacci dentro, CI RIUSCIRAI!
        </Text>
      </ScrollView>
      <TouchableOpacity style={styles.instructionsButton} onPress={onDone}>
        <Text style={styles.instructionsButtonText} adjustsFontSizeToFit minimumFontScale={0.6}>
          Ho capito, iniziamo
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SettingsScreen({ onSave }) {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [price, setPrice] = useState('');
  return (
    <View style={sty
