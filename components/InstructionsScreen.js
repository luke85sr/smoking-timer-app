import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';

export default function InstructionsScreen({ onDone }) {
  const theme = Appearance.getColorScheme();

  const handleDone = async () => {
    await AsyncStorage.setItem('@seenInstructions', 'true');
    onDone();
  };

  const colors = theme === 'dark'
    ? ['#121212', '#121212', '#121212']
    : ['#A8E6CF', '#FFFFFF', '#A0CED9'];

  return (
    <LinearGradient colors={colors} style={styles.container}>
      <Text style={styles.text}>
        L'app ti aiuta ad allungare il tempo tra una sigaretta e l'altra.{'\n\n'}
        Dopo aver impostato i dati clicca “STO FUMANDO” all’accensione,{'\n'}
        vedrai un timer di base di 40 minuti che aumenterà di 10 minuti ogni 5 giorni.{'\n\n'}
        Troverai un report quotidiano e totale sui tuoi progressi.
      </Text>
      <Text style={styles.boldText}>
        Quando avvii la sessione di fumo, puoi lasciare l'app in background o richiuderla,{'\n'}
        una volta terminata la pausa riceverai una notifica per ricordarti che, se vuoi, puoi fumare.{'\n'}
        Ma puoi anche non fumare subito e prendere più tempo e aria pulita per i tuoi polmoni.
      </Text>
      <Text style={styles.upperText}>
        BUONA FORTUNA, CI RIUSCIRAI!
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleDone}>
        <Text style={styles.buttonText}>HO CAPITO</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', padding:100 },
  text: { fontSize:16, textAlign:'center', marginBottom:20, color:'#333' },
  boldText: { fontSize:16, textAlign:'center', fontWeight:'bold', marginBottom:20, color:'#333' },
  upperText: { fontSize:18, textAlign:'center', fontWeight:'bold', marginBottom:30, textTransform:'uppercase', color:'#d32f2f' },
  button: { backgroundColor:'#2196F3', padding:15, borderRadius:8 },
  buttonText: { color:'#fff', fontSize:16, fontWeight:'bold' }
});
