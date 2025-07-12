import React, { useState, useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InitialSetupScreen from './components/InitialSetupScreen';
import InstructionsScreen from './components/InstructionsScreen';
import MainScreen from './components/MainScreen';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('');

  useEffect(() => {
    (async () => {
      const seenInstructions = await AsyncStorage.getItem('@seenInstructions');
      const isConfigured = await AsyncStorage.getItem('@userName');
      if (!seenInstructions) {
        setScreen('instructions');
      } else if (!isConfigured) {
        setScreen('setup');
      } else {
        setScreen('main');
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <ActivityIndicator size="large" color="#000" />;

  if (screen === 'instructions') {
    return <InstructionsScreen onDone={() => setScreen('setup')} />;
  } else if (screen === 'setup') {
    return <InitialSetupScreen onSetupComplete={() => setScreen('main')} />;
  } else {
    return <MainScreen onReset={() => setScreen('instructions')} />;
  }
}
