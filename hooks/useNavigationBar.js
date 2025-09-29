import { useEffect } from "react";
import * as NavigationBar from "expo-navigation-bar";

export function useHideNavigationBar() {
    useEffect(() => {
        NavigationBar.setVisibilityAsync("hidden");
        NavigationBar.setBehaviorAsync("immersive");

        return () => {
            NavigationBar.setVisibilityAsync("visible");
            NavigationBar.setBehaviorAsync("inset-swipe");
        };
    }, []);
}