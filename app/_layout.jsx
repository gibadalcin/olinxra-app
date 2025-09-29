import { Stack } from "expo-router";
import { useHideNavigationBar } from '../hooks/useNavigationBar';

export default function Layout() {
    useHideNavigationBar();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
}