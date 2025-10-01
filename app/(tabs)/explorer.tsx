import { View, Text } from "react-native";
import { getHeaderOptions } from "@/components/ui/HeaderOptions";
import { Colors } from "@/constants/Colors";

export const options = getHeaderOptions(
    "Explorar",
    undefined,
    Colors.light.headerText,
    Colors.light.headerBg
);

export default function ExplorerScreen() {
    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text>Aqui será o conteúdo da tela Explorar</Text>
        </View>
    );
}