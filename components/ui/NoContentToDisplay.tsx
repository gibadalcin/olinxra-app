import React from 'react';
import { Modal, View, StyleSheet, Text, Button } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface NoContentToDisplayProps {
  visible: boolean;
  onCancel?: () => void;
  brand?: string | null;
  location?: string | null;
}

export function NoContentToDisplayModal({ visible, onCancel, brand, location }: NoContentToDisplayProps) {
  const displayBrand = brand || 'desconhecida';
  // Nota: location era calculada mas não usada — mantemos apenas a marca para esta modal

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Image
            source={require('../../assets/images/adaptive-icon.png')}
            style={styles.logo}
            contentFit='contain' />
          <Text style={styles.title}>Ops! Não existe conteúdo associado à marca {displayBrand} nessa localização</Text>
          <Text style={styles.subtitle}>
            Tente capturar outra logomarca ou explore o ambiente{' '}
            <MaterialCommunityIcons name="magnify-expand" size={18} color={Colors.light.icon} />
            {' '}em busca de conteúdo dinâmico.
          </Text>
          <Button title="Fechar" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: .4,
    width: '90%',
    backgroundColor: Colors.global.light,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 260,
  },
  logo: {
    width: 84,
    height: 74,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: Colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 16,
    color: Colors.light.text,
    textAlign: 'center',
  },
});