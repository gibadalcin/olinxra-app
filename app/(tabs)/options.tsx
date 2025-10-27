import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useCaptureSettings } from '@/context/CaptureSettingsContext';
import { Switch, StyleSheet, Alert, Platform, BackHandler, TouchableOpacity } from 'react-native';
import CustomHeader from '@/components/CustomHeader';

const headerTitle = "Opções de configuração";

export default function Options() {

    const { showOrientation, setShowOrientation } = useCaptureSettings();
    // options no longer persist or control permission flags.
    return (
        <ThemedView style={{ flex: 1 }}>
            <CustomHeader title={headerTitle} />

            <ThemedView style={styles.container}>
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
                            trackColor={{ false: Colors.global.blueDark + '33', true: Colors.global.bg + '66' }}
                            thumbColor={showOrientation ? Colors.global.bg : Colors.light.background}
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
                {/* simulated permission modal removed - native OS prompts will be used */}
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
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 20,
        gap: 16,
    },
    functionsBlock: {
        top: 24,
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
        bottom: 6,
        left: 0,
        right: 0,
        alignItems: "center",
        backgroundColor: 'transparent',
        zIndex: 20, // Adicionado para ficar acima do overlay
        paddingBottom: 2,
    },
    footerText: {
        color: Colors.global.blueDark,
        fontSize: 14,
        marginBottom: 2,
        marginTop: 20
    },
    footerVersion: {
        color: Colors.global.blueDark,
        fontSize: 12,
        marginBottom: 0,
    },
    controlButtons: {
        marginTop: 12,
        width: '100%',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center'
    },
    smallButton: {
        width: '90%',
        padding: 10,
        backgroundColor: Colors.global.blueLight,
        borderRadius: 8,
        alignItems: 'center'
    },
    smallButtonText: {
        color: '#fff',
        fontWeight: '700'
    }
});