import { Tabs } from "expo-router";
import CustomTabBar from "@/components/CustomTabBar";
import { useHideNavigationBar } from '@/hooks/useNavigationBar';
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemedView } from '@/components/ThemedView';
import { Colors } from "@/constants/Colors";

export default function TabLayout() {
    useHideNavigationBar();

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
                        name="recognizer"
                        options={{
                            headerShown: false,
                        }}
                    />
                    <Tabs.Screen
                        name="explorer"
                        options={{
                            headerShown: false,
                        }}
                    />
                    <Tabs.Screen
                        name="help"
                        options={{
                            headerShown: false,
                        }}
                    />
                    <Tabs.Screen
                        name="options"
                        options={{
                            headerShown: false,
                        }}
                    />
                    <Tabs.Screen
                        name="ar-view"
                        options={{
                            headerShown: false,
                        }}
                    />
                </Tabs>
            </ThemedView>
        </GestureHandlerRootView>
    );
}