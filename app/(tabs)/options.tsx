import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";

export default function Options() {

    return (
        <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.light.background }}>
            {/* Bloco de funções de sistema */}
            <ThemedView style={{
                marginTop: 32,
                padding: 16,
                borderWidth: 0.5,
                borderColor: Colors.global.blueDark + '99', // 0.6 de opacidade em hex
                borderRadius: 10,
                backgroundColor: Colors.light.background,
                width: '85%',
                alignItems: 'center',
            }}>
                <ThemedText style={{ fontSize: 15, color: Colors.global.blueDark, marginBottom: 12, fontWeight: 'bold' }}>
                    Funções de captura
                </ThemedText>
                <ThemedView style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: '100%' }}>
                </ThemedView>
            </ThemedView>

            <ThemedView style={{ position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center", backgroundColor: 'transparent' }}>
                <ThemedText style={{ color: Colors.global.blueDark, fontSize: 14, marginBottom: 4 }}>
                    © {new Date().getFullYear()} Olinx Digital
                </ThemedText>
                <ThemedText style={{ color: Colors.global.blueDark, fontSize: 12 }}>
                    Versão {require('../../package.json').version}
                </ThemedText>
            </ThemedView>
        </ThemedView>
    );
}