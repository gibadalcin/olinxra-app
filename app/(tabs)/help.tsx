import { Text, StyleSheet, Pressable, View, AppState, AppStateStatus } from "react-native";
import { Colors } from '@/constants/Colors';
import { ThemedView } from "@/components/ThemedView";
import CustomHeader from '@/components/CustomHeader';
import { useState, useEffect, useRef } from 'react';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function HelpScreen() {
    const headerTitle = "Como funciona";
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const params = useLocalSearchParams();
    const openedFromParams = useRef(false);
    const focus = params && params.focus ? String(params.focus).toLowerCase() : '';

    useEffect(() => {
        try {
            // Only open once when the screen is first mounted via a link with ?open=permissions
            if (!openedFromParams.current && params && params.open) {
                const v = String(params.open).toLowerCase();
                if (v === 'permissions' || v === '1' || v === 'true') {
                    setOpen(true);
                    openedFromParams.current = true;
                }
            }
        } catch (e) { }
    }, [params]);

    // Helper to check current native permissions; if all granted, close accordion and clear params
    const checkPermissionsAndMaybeClose = async () => {
        try {
            const cam = await Camera.getCameraPermissionsAsync();
            const gal = await ImagePicker.getMediaLibraryPermissionsAsync();
            const loc = await Location.getForegroundPermissionsAsync();
            const granted = cam.status === 'granted' && gal.status === 'granted' && loc.status === 'granted';
            if (granted && open) {
                setOpen(false);
                if (openedFromParams.current) {
                    try { router.replace('/(tabs)/help'); } catch (e) { }
                    openedFromParams.current = false;
                }
            }
            return granted;
        } catch (e) {
            return false;
        }
    };

    // Run check on mount and when app comes to foreground (user may have changed permissions in Settings)
    useEffect(() => {
        checkPermissionsAndMaybeClose();
        const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
            if (next === 'active') {
                checkPermissionsAndMaybeClose();
            }
        });
        return () => subscription.remove();
    }, []);

    return (
        <ThemedView style={{ flex: 1 }}>
            <CustomHeader title={headerTitle} />
            <ThemedView style={styles.container}>
                <Pressable onPress={() => {
                    // toggle with cleanup: if we are closing and the accordion was opened from params,
                    // remove the query param from the URL to keep it clean.
                    const next = !open;
                    setOpen(next);
                    if (!next && openedFromParams.current) {
                        try { router.replace('/(tabs)/help'); } catch (e) { }
                        openedFromParams.current = false;
                    }
                }} style={styles.accordionHeader} accessibilityRole="button">
                    <Text style={styles.accordionTitle}>Sobre permissões e acessos</Text>
                    <Text style={styles.accordionToggle}>{open ? '-' : '+'}</Text>
                </Pressable>
                {open && (
                    <View style={styles.accordionBody}>
                        <Text style={styles.accordionText}>
                            Para que o app funcione corretamente precisamos de algumas permissões:
                        </Text>
                        <Text style={styles.accordionText}><Text style={[styles.itens, focus === 'location' && styles.bold]}>• Localização</Text>: é usada única e exclusivamente para localizar conteúdos AR próximos e melhorar resultados.</Text>
                        <Text style={styles.accordionText}><Text style={[styles.itens, focus === 'camera' && styles.bold]}>• Câmera</Text>: necessária para capturar imagens e reconhecer logomarcas. Sem permitir acesso à câmera você não poderá acessar a tela de captura nem a tela de explorar o ambiente.</Text>
                        <Text style={styles.accordionText}><Text style={[styles.itens, focus === 'gallery' && styles.bold]}>• Galeria</Text>: necessária para selecionar imagens já existentes, salvar capturas temporárias e enviar imagens ao servidor para reconhecimento. O app nunca expõe credenciais de armazenamento — usamos URLs assinadas geradas pelo nosso backend para transfers seguras.</Text>
                        <Pressable style={styles.openOptions} onPress={() => router.push('/(tabs)/recognizer')}>
                            <Text style={styles.openOptionsText}>Ir para Captura</Text>
                        </Pressable>
                    </View>
                )}
            </ThemedView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '80%',
        bottom: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -16, // Adiciona sobreposição de 16px sobre o header
        paddingTop: 20,
        alignItems: 'center',
    },
    accordionHeader: { width: '85%', padding: 12, backgroundColor: 'transparent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderColor: '#ccc' },
    accordionTitle: { fontSize: 16, fontWeight: '600' },
    accordionToggle: { fontSize: 24, fontWeight: '700' },
    accordionBody: { width: '85%', padding: 12, backgroundColor: Colors.light.background, borderRadius: 8, marginTop: 8 },
    accordionText: { color: Colors.global.dark, marginBottom: 8 },
    openOptions: { marginTop: 8, padding: 10, backgroundColor: Colors.global.blueLight, borderRadius: 8, alignItems: 'center' },
    openOptionsText: { color: '#fff', fontWeight: '700' },
    itens: { fontWeight: '600' },
    bold: { fontWeight: '700' },
});