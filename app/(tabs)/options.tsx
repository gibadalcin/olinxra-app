import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useCaptureSettings } from '@/context/CaptureSettingsContext';
import { Switch, View, Image, Text, StyleSheet } from 'react-native';

const headerTitle = "Configurações globais";

export default function Options() {

    const { showOrientation, setShowOrientation } = useCaptureSettings();

    return (
        <ThemedView style={{ flex: 1, backgroundColor: Colors.light.background }}>
            {/* Header customizado fixo no topo */}
            <View style={styles.customHeader}>
                <Image
                    source={require('@/assets/images/adaptive-icon-w.png')}
                    style={styles.headerIcon}
                />
                <Text style={styles.headerText}>{headerTitle}</Text>
            </View>

            {/* Bloco de funções de sistema */}
            <ThemedView style={styles.functionsBlock}>
                <ThemedText style={styles.functionsTitle}>
                    Funções da tela de captura
                </ThemedText>
                <ThemedView style={styles.switchRow}>
                    <ThemedText style={styles.switchLabel}>
                        Mostrar orientação de captura
                    </ThemedText>
                    <Switch
                        value={showOrientation}
                        onValueChange={setShowOrientation}
                        trackColor={{ false: Colors.global.blueDark + '33', true: Colors.global.blueDark + '66' }}
                        thumbColor={showOrientation ? Colors.global.blueDark : Colors.light.background}
                    />
                </ThemedView>
            </ThemedView>

            <ThemedView style={styles.footer}>
                <ThemedText style={styles.footerText}>
                    © {new Date().getFullYear()} Olinx Digital
                </ThemedText>
                <ThemedText style={styles.footerVersion}>
                    Versão {require('../../package.json').version}
                </ThemedText>
            </ThemedView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    customHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '12%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '12%',
        paddingBottom: 8,
        paddingHorizontal: 16,
        zIndex: 100,
        backgroundColor: Colors.global.blueDark + '66', // glass effect
        overflow: 'hidden',
        gap: 8,
    },
    headerIcon: {
        width: 32,
        height: 32,
        marginRight: 8,
        resizeMode: 'contain',
    },
    headerText: {
        fontSize: 20,
        height: 32,
        fontWeight: 'bold',
        color: Colors["global"]?.light || '#ffffff',
        textAlign: 'center',
        flex: 0,
        textShadowColor: 'rgba(0,0,0,0.12)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    functionsBlock: {
        top: '16%',
        padding: 16,
        borderWidth: 0.5,
        borderColor: Colors.global.blueDark + '99',
        borderRadius: 10,
        backgroundColor: Colors.light.background,
        width: '85%',
        alignSelf: 'center',
        alignItems: 'center',
    },
    functionsTitle: {
        fontSize: 15,
        color: Colors.global.blueDark,
        marginBottom: 12,
        fontWeight: 'bold',
    },
    switchRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: '100%',
    },
    switchLabel: {
        fontSize: 14,
        color: Colors.global.blueDark,
    },
    footer: {
        position: "absolute",
        bottom: 24,
        left: 0,
        right: 0,
        alignItems: "center",
        backgroundColor: 'transparent',
    },
    footerText: {
        color: Colors.global.blueDark,
        fontSize: 14,
        marginBottom: 4,
    },
    footerVersion: {
        color: Colors.global.blueDark,
        fontSize: 12,
    },
});