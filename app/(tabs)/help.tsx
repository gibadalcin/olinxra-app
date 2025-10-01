import { View, Text } from "react-native";
import { getHeaderOptions } from "@/components/ui/HeaderOptions";
import { Colors } from "@/constants/Colors";

export const options = getHeaderOptions(
    "Ajuda",
    undefined,
    Colors.light.headerText,
    Colors.light.headerBg
);

export default function HelpScreen() {
    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text>Aqui será o conteúdo da tela Ajuda</Text>
        </View>
    );
}