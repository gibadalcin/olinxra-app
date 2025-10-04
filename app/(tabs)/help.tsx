import { View, Text } from "react-native";
import { Image } from "expo-image";
import { StyleSheet } from "react-native";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/ThemedView";

export default function HelpScreen() {
    const headerTitle = "Como funciona";
    return (
        <ThemedView style={{ flex: 1 }}>
            {/* Header customizado fixo no topo */}
            <View style={styles.customHeader}>
                <View style={styles.customHeaderContent}>
                    <Image
                        source={require('@/assets/images/adaptive-icon-w.png')}
                        style={styles.headerIcon}
                    />
                    <View>
                        <Text style={styles.headerText}>{headerTitle}</Text>
                    </View>
                </View>
            </View>
            <ThemedView style={styles.container}>
                <Text>Aqui será o conteúdo da tela Ajuda</Text>
            </ThemedView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    customHeader: {
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.global.bg + 'ee',
        paddingTop: 30,
        paddingBottom: 0,
        overflow: 'hidden',
        gap: 8,
    },
    customHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        width: '100%',
        paddingBottom: 12,
    },
    headerIcon: {
        width: 32,
        height: 32,
        marginRight: 12,
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
    container: {
        width: '100%',
        height: '80%',
        bottom: 0,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -14, // Adiciona sobreposição de 14px sobre o header
        justifyContent: 'center',
        alignItems: 'center',
    },
});