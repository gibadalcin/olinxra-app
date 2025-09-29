import { Stack } from "expo-router";
import { useHideNavigationBar } from '../hooks/useNavigationBar';

export default function Layout() {
    useHideNavigationBar(); // Chama o hook para esconder a barra
    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
}