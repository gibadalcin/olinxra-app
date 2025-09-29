import { router } from 'expo-router';

export function useHistory() {
    function openHistory() {
        router.push('/(tabs)/recognizer/history');
    }

    return { openHistory };
}