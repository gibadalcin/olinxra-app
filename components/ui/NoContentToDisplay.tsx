import React, { useEffect, useState } from 'react';
import { Modal, View, StyleSheet, ActivityIndicator, Text, Button } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';

interface LoadingCaptureModalProps {
  visible: boolean;
  onFinish?: () => void;
  onCancel?: () => void;
  result?: { status: 'success' | 'error' };
  minDuration?: number; // em ms
}

export function LoadingCaptureModal({ visible, onFinish, onCancel, result, minDuration = 3000 }: LoadingCaptureModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: number;
    if (visible) {
      setShow(true);
      timer = setTimeout(() => {
        if (onFinish) onFinish();
      }, minDuration);
    } else {
      setShow(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, minDuration, onFinish]);

  if (result?.status === 'error') {
    return (
      <View>
        <Text>Ocorreu um erro ao processar a imagem.</Text>
        <Button title="Cancelar" onPress={onCancel} />
      </View>
    );
  }

  return (
    <Modal visible={show} transparent animationType="fade">
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color={Colors.global.blueLight} />
      </View>
    </Modal>
  );
}

interface NoContentToDisplayProps {
  visible: boolean;
  onCancel?: () => void;
}

export function NoContentToDisplayModal({ visible, onCancel }: NoContentToDisplayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Image
            source={require('../../assets/images/adaptive-icon.png')}
            style={styles.logo}
            contentFit='contain' />
          <Text style={styles.title}>Ops! Não existe conteúdo associado à marca na região de XXXX</Text>
          <Text style={styles.subtitle}>
            Tente capturar outra logomarca ou explore o ambiente{' '}
            <MaterialIcons name="explore" size={18} color={Colors.light.icon} />
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
    flex: 1,
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