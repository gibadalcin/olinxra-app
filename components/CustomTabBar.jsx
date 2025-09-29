import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { MaterialIcons, Ionicons, SimpleLineIcons } from "@expo/vector-icons";

const icons = [
    { name: "home", label: "Home", route: "/(tabs)/", family: Ionicons },
    { name: "camera", label: "Recognizer", route: "/(tabs)/recognizer", family: Ionicons },
    { name: "compass", label: "Explorer", route: "/(tabs)/explorer", family: Ionicons },
    { name: "help-circle", label: "Help", route: "/(tabs)/help", family: Ionicons },
    { name: "settings", label: "Options", route: "/(tabs)/options", family: Ionicons },
];

const activeColor = "#012E57";
const inactiveColor = "#012E57";
const inactiveOpacity = 0.6;

export default function CustomTabBar({ state }) {
    const router = useRouter();
    const segments = useSegments();
    const activeRoute = segments[segments.length - 1] || "index";

    if (!state || !state.routes) {
        return null;
    }

    return (
        <View
            style={{
                flexDirection: "row",
                justifyContent: "space-around",
                alignItems: "center",
                height: 64,
                backgroundColor: "#fff",
                borderTopWidth: 1,
                borderTopColor: "#B3CDE0",
            }}
        >
            {icons.map((icon, index) => {
                const routeSegment = icon.route.split("/").filter(Boolean).pop();
                const isActive = (icon.route === "/(tabs)/" && activeRoute === "index") || activeRoute === routeSegment;

                return (
                    <TouchableOpacity
                        key={icon.name}
                        onPress={() => router.replace(icon.route)}
                        style={{ flex: 1, alignItems: "center" }}
                    >
                        <icon.family
                            name={icon.name}
                            size={28}
                            color={isActive ? activeColor : inactiveColor}
                            style={{ opacity: isActive ? 1 : inactiveOpacity }}
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}