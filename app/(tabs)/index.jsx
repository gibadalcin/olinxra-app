import React from "react";
import { View, Text } from "react-native";
import { useHideNavigationBar } from '../../hooks/useNavigationBar';

export default function TabsHome() {
    useHideNavigationBar(); // Chama o hook para esconder a barra

    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text>Escolha uma aba</Text>
        </View>
    );
}