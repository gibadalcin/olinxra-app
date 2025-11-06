import React from "react";
import type { NavigationState } from '@react-navigation/native';
import { TouchableOpacity } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedView } from "./ThemedView";
import { ThemedText } from "./ThemedText";
import { Colors } from "@/constants/Colors";

const icons = [
    { name: "camera", label: "Capturar", route: "/_tabs/recognizer", family: Ionicons },
    { name: "magnify-expand", label: "Explorar", route: "/_tabs/explorer", family: MaterialCommunityIcons },
    { name: "help-circle", label: "Ajuda", route: "/_tabs/help", family: Ionicons },
    { name: "settings", label: "Opções", route: "/_tabs/options", family: Ionicons },
];

const activeColor = Colors.global.blueDark;
const inactiveColor = activeColor;
const inactiveOpacity = 0.6;

export default function CustomTabBar({ state }: { state: NavigationState }) {
    const router = useRouter();
    const segments = useSegments();
    const activeRoute = segments[segments.length - 1] || "index";
    // No local permission flags — tabs always enabled. Permission gating happens in the Recognizer screen.

    if (!state || !state.routes) {
        return null;
    }

    return (
        <ThemedView
            style={{
                flexDirection: "row",
                justifyContent: "space-around",
                alignItems: "center",
                height: 64,
                backgroundColor: Colors.light.tabBarBg,
                borderTopWidth: .3,
                borderTopColor: Colors.global.soft,
            }}
        >
            {icons.map((icon) => {
                const routeSegment = icon.route.split("/").filter(Boolean).pop();
                const isActive = (icon.route === "/_tabs/" && activeRoute === "index") || activeRoute === routeSegment;

                // Tabs are always enabled; the Recognizer screen handles permission checks itself.
                const disabledForCamera = false;
                return (
                    <TouchableOpacity
                        key={icon.name}
                        onPress={() => { if (!disabledForCamera) router.replace(icon.route); }}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                        accessibilityState={{ disabled: disabledForCamera }}
                    >
                        <icon.family
                            name={icon.name as any}
                            size={28}
                            color={isActive ? activeColor : (disabledForCamera ? '#888' : inactiveColor)}
                            style={{ opacity: isActive ? 1 : (disabledForCamera ? 0.4 : inactiveOpacity) }}
                        />
                        <ThemedText
                            style={{
                                fontSize: 10,
                                color: isActive ? activeColor : (disabledForCamera ? '#888' : inactiveColor),
                                opacity: isActive ? 1 : (disabledForCamera ? 0.6 : inactiveOpacity),
                                marginTop: -2,
                            }}
                        >
                            {icon.label}
                        </ThemedText>
                    </TouchableOpacity>
                );
            })}
        </ThemedView>
    );
}