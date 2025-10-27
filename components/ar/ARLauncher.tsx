import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { ARLauncherProps } from './types';

export default function ARLauncher({ isReady, statusMessage, onLaunch, styles, showButton = true }: ARLauncherProps) {
    return (
        <View style={styles.overlayNative}>
            <Text style={styles.launchText}>{statusMessage}</Text>

            <View style={styles.bottomBar}>
                {showButton ? (
                    <TouchableOpacity
                        style={[styles.mainActionButton, !isReady && { opacity: 0.5 }]}
                        onPress={() => isReady && onLaunch()}
                        disabled={!isReady}
                    >
                        <Text style={styles.mainActionText}>VER EM RA</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}
