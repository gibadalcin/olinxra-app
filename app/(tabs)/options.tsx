import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { getHeaderOptions } from "@/components/ui/HeaderOptions";

export const options = getHeaderOptions(
    "Opções",
    undefined,
    Colors.light.headerText,
    Colors.light.headerBg
);

export default function Options() {
    return (
        <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.light.background }}>
            <ThemedText style={{ fontSize: 18, color: Colors.light.text }}>Opções</ThemedText>
        </ThemedView>
    );
}