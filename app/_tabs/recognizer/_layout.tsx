import { useHideNavigationBar } from '@hooks/useNavigationBar';
import { Stack } from 'expo-router'; // Importe o Stack

export default function RecognizerLayout() {
    useHideNavigationBar();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
            }}
        />
    );
}