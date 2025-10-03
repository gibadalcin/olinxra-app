import { Tabs } from "expo-router";
import CustomTabBar from "@/components/CustomTabBar";
import { useHideNavigationBar } from '@/hooks/useNavigationBar';
import { Ionicons } from "@expo/vector-icons";
import { getHeaderOptions } from "@/components/ui/HeaderOptions";
import { Colors } from "@/constants/Colors";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemedView } from '@/components/ThemedView';

export default function TabLayout() {
    useHideNavigationBar();

    const ICON_SIZE = 24;
    const tabIconStyle = (focused: boolean) => ({ opacity: focused ? 1 : 0.6 });
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemedView style={{ flex: 1 }}>
                <Tabs
                    screenOptions={{
                        tabBarActiveTintColor: Colors["light"].tabIconSelected,
                        tabBarInactiveTintColor: Colors["light"].tabIconDefault,
                        tabBarStyle: {
                            backgroundColor: Colors["light"].tabBarBg,
                            borderTopWidth: 1,
                            borderTopColor: "#eee",
                        },
                    }}
                    tabBar={props => <CustomTabBar {...props} />}
                >
                    <Tabs.Screen
                        name="index"
                        options={{
                            ...getHeaderOptions(
                                "Home",
                                undefined,
                                Colors["light"].headerText,
                                Colors["light"].headerBg
                            ),
                            headerShown: false,
                            tabBarIcon: ({ color, focused }) => (
                                <ThemedView style={tabIconStyle(focused)}>
                                    <Ionicons name="home-outline" size={ICON_SIZE} color={color} />
                                </ThemedView>
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
                                <ThemedView style={tabIconStyle(focused)}>
                                    <Ionicons name="compass-outline" size={ICON_SIZE} color={color} />
                                </ThemedView>
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="recognizer"
                        options={{
                            ...getHeaderOptions(
                                "Capturar Logomarca",
                                undefined,
                                Colors["light"].headerText,
                                'transparent'
                            ),
                            headerShown: false,
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
                                <ThemedView style={tabIconStyle(focused)}>
                                    <Ionicons name="help-circle-outline" size={ICON_SIZE} color={color} />
                                </ThemedView>
                            ),
                        }}
                    />
                    <Tabs.Screen
                        name="options"
                        options={{
                            headerShown: false,
                        }}
                    />
                </Tabs>
            </ThemedView>
        </GestureHandlerRootView>
    );
}