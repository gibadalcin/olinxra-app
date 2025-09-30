// app/index.jsx
import { Image, Dimensions } from "react-native";
import { ThemedView } from "../../components/ThemedView";
import { ThemedText } from "../../components/ThemedText";
import { Colors } from "../../constants/Colors";

export default function TabsHome() {
    const logo = require("../../assets/images/logo-app.png");

    const screenWidth = Dimensions.get('window').width;
    return (
        <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Image
                source={logo}
                style={{ width: screenWidth * 0.6, height: 160 }}
                resizeMode="contain"
            />
            <ThemedText style={{ marginTop: -40, fontSize: 16 }}>Reconheça. Localize. Explore.</ThemedText>
        </ThemedView>
    );
}