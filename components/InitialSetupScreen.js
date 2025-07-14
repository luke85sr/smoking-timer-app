import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';

export default function InitialSetupScreen({ onSetupComplete }) {
  const [name, setName] = useState('');
  const [cigsPerDay, setCigsPerDay] = useState('');
  const [packPrice, setPackPrice] = useState('');
  const theme = Appearance.getColorScheme();

  const handleSave = async () => {
    if (name && cigsPerDay && packPrice) {
      await AsyncStorage.multiSet([
        ['@userName', name],
        ['@cigsPerDay', cigsPerDay],
        ['@packPrice', packPrice],
      ]);
      onSetupComplete();
    }
  };

  const colors = theme === 'dark'
    ? ['#121212', '#121212', '#121212']
    : ['#A8E6CF', '#FFFFFF', '#A0CED9'];

  return (
    <LinearGradient colors={colors} style={styles.container}>
      <Text style={styles.title}>Configurazione Iniziale</Text>
      <TextInput
        style={styles.input}
        placeholder="Inserisci il tuo nome"
        placeholderTextColor="#888"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Sigarette fumate al giorno"
        placeholderTextColor="#888"
        keyboardType="numeric"
        value={cigsPerDay}
        onChangeText={setCigsPerDay}
      />
      <TextInput
        style={styles.input}
        placeholder="Prezzo del pacchetto (€)"
        placeholderTextColor="#888"
        keyboardType="numeric"
        value={packPrice}
        onChangeText={setPackPrice}
      />
      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>SALVA</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', alignItems:'center', padding:100 },
  title: { fontSize:24, fontWeight:'bold', marginBottom:20, color:'#333' },
  input: {
    width:'100%', backgroundColor:'#f0f0f0', borderRadius:8, padding:12, marginVertical:10,
    color:'#000'
  },
  button: { backgroundColor:'#2196F3', padding:15, borderRadius:8, marginTop:20 },
  buttonText: { color:'#fff', fontSize:16, fontWeight:'bold' }
});
