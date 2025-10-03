import React from "react";
import type { NavigationState } from '@react-navigation/native';
import { TouchableOpacity } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedView } from "./ThemedView";
import { ThemedText } from "./ThemedText";

const icons = [
    { name: "home", label: "Home", route: "/(tabs)/", family: Ionicons },
    { name: "camera", label: "Capturar", route: "/(tabs)/recognizer", family: Ionicons },
    { name: "magnify-expand", label: "Explorar", route: "/(tabs)/explorer", family: MaterialCommunityIcons },
    { name: "help-circle", label: "Ajuda", route: "/(tabs)/help", family: Ionicons },
    { name: "settings", label: "Opções", route: "/(tabs)/options", family: Ionicons },
];

const activeColor = "#012E57";
const inactiveColor = "#012E57";
const inactiveOpacity = 0.6;

export default function CustomTabBar({ state }: { state: NavigationState }) {
    const router = useRouter();
    const segments = useSegments();
    const activeRoute = segments[segments.length - 1] || "index";

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
                backgroundColor: "#FCFCFC",
                borderTopWidth: 1,
                borderTopColor: "#B3CDE0",
            }}
        >
            {icons.map((icon) => {
                const routeSegment = icon.route.split("/").filter(Boolean).pop();
                const isActive = (icon.route === "/(tabs)/" && activeRoute === "index") || activeRoute === routeSegment;

                return (
                    <TouchableOpacity
                        key={icon.name}
                        onPress={() => router.replace(icon.route)}
                        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                    >
                        <icon.family
                            name={icon.name as any}
                            size={28}
                            color={isActive ? activeColor : inactiveColor}
                            style={{ opacity: isActive ? 1 : inactiveOpacity }}
                        />
                        <ThemedText
                            style={{
                                fontSize: 10,
                                color: isActive ? activeColor : inactiveColor,
                                opacity: isActive ? 1 : inactiveOpacity,
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