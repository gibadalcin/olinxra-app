import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export async function saveToGallery(imageUri: string): Promise<boolean> {
  try {
    await MediaLibrary.saveToLibraryAsync(imageUri);
    Alert.alert('Sucesso', 'Imagem salva na galeria!');
    return true;
  } catch (e: any) {
    if (e?.code === 'ERR_NO_PERMISSION') {
      Alert.alert('Permissão negada', 'Não foi possível acessar a galeria.');
    } else {
      Alert.alert('Erro', 'Não foi possível salvar a imagem.');
    }
    return false;
  }
}