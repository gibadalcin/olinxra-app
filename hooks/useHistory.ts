import { router } from 'expo-router';

export function useHistory() {
    function openHistory() {
        router.push('/_tabs/recognizer/history');
    }

    return { openHistory };
}