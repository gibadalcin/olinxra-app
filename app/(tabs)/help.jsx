import { View, Text } from "react-native";
import { getHeaderOptions } from "../../components/ui/HeaderOptions";

export const options = getHeaderOptions("Testando headeroptions");

export default function HelpScreen() {
    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text>Conteúdo da tela Ajuda</Text>
        </View>
    );
}