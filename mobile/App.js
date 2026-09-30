import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>EYE TROOPS</Text>
        <Text style={styles.title}>Clinic workspace</Text>
        <Text style={styles.subtitle}>Your mobile app is ready to build.</Text>
      </View>
      <View style={styles.status}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Connected to Expo Go</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF5EC',
    padding: 28,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 64,
  },
  eyebrow: {
    color: '#36766F',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 18,
  },
  title: {
    color: '#252A28',
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    color: '#656B67',
    fontSize: 16,
    marginTop: 10,
  },
  status: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusDot: {
    backgroundColor: '#36766F',
    borderRadius: 5,
    height: 10,
    marginRight: 10,
    width: 10,
  },
  statusText: {
    color: '#252A28',
    fontSize: 14,
    fontWeight: '600',
  },
});
