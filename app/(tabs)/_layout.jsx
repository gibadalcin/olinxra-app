import { Tabs } from "expo-router";
import CustomTabBar from "../../components/CustomTabBar"; // Ajuste o caminho se necessário
import { useHideNavigationBar } from '../../hooks/useNavigationBar'; // Ajuste o caminho se necessário
import { Ionicons } from "@expo/vector-icons";
import { getHeaderOptions } from "../../components/ui/HeaderOptions";
import { Colors } from "../../constants/Colors";
import { Image } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function TabLayout() {
    useHideNavigationBar();

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: Colors["light"].tabIconActive, // Cor do ícone ativo
                    tabBarInactiveTintColor: Colors["light"].tabIconDefault, // Cor do ícone inativo
                    tabBarStyle: {
                        backgroundColor: Colors["light"].tabBarBg,
                        borderTopWidth: 1,
                        borderTopColor: "#eee",
                    },
                }}
                tabBar={props => <CustomTabBar {...props} />}
            >
                <Tabs.Screen
                    name="index" // Home
                    options={{
                        ...getHeaderOptions(
                            "Home",
                            undefined, // ou uma imagem
                            Colors["light"].headerText,
                            Colors["light"].headerBg
                        ),
                        headerShown: false,
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ opacity: focused ? 1 : 0.6 }}>
                                <Ionicons name="home-outline" size={24} color={color} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="explorer"
                    options={{
                        ...getHeaderOptions(
                            "Explorar",
                            undefined,
                            Colors["light"].headerText,
                            Colors["light"].headerBg
                        ),
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ opacity: focused ? 1 : 0.6 }}>
                                <Ionicons name="compass-outline" size={24} color={color} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="recognizer"
                    options={{
                        ...getHeaderOptions(
                            "Capturar Logomarcas",
                            undefined,
                            Colors["light"].headerText,
                            Colors["light"].headerBg
                        ),
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ opacity: focused ? 1 : 0.6 }}>
                                <Ionicons name="camera-outline" size={24} color={color} />
                            </View>
                        ),
                        headerLeft: () => (
                            <Image
                                source={require('../../assets/images/adaptive-icon.png')}
                                style={{ width: 32, height: 32, marginLeft: 16, marginRight: 8 }}
                            />
                        ),
                        headerStyle: {
                            borderBottomWidth: 2,
                            borderBottomColor: Colors["global"].blueSoft, // cor da borda
                            backgroundColor: Colors["light"].headerBg,
                        },
                    }}
                />
                <Tabs.Screen
                    name="help"
                    options={{
                        ...getHeaderOptions(
                            "Ajuda",
                            undefined,
                            Colors["light"].headerText,
                            Colors["light"].headerBg
                        ),
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ opacity: focused ? 1 : 0.6 }}>
                                <Ionicons name="help-circle-outline" size={24} color={color} />
                            </View>
                        ),
                    }}
                />
                <Tabs.Screen
                    name="options"
                    options={{
                        ...getHeaderOptions(
                            "Opções",
                            undefined,
                            Colors["light"].headerText,
                            Colors["light"].headerBg
                        ),
                        tabBarIcon: ({ color, focused }) => (
                            <View style={{ opacity: focused ? 1 : 0.6 }}>
                                <Ionicons name="settings-outline" size={24} color={color} />
                            </View>
                        ),
                    }}
                />
            </Tabs>
        </GestureHandlerRootView>
    );
}