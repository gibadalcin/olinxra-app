import React from 'react';
import { View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { ThemedView } from '@/components/ThemedView';
import { Image } from 'expo-image';
import type { ARPreviewProps } from './types';

export default function ARPreviewViewer({ html, baseUrl, webRef, onMessageHandler, styles, screenHeight, normalizedKey }: ARPreviewProps) {
    const headerTitle = 'Visualização em AR';

    return (
        <ThemedView style={{ flex: 1 }}>
            <View style={styles.customHeader}>
                <View style={styles.customHeaderContent}>
                    <Image
                        source={require('@/assets/images/adaptive-icon-w.png')}
                        style={styles.headerIcon}
                    />
                    <View>
                        <Text style={styles.headerText}>{headerTitle}</Text>
                    </View>
                </View>
            </View>

            <View style={{ flex: 1, height: screenHeight, position: 'absolute', top: 0, left: 0, right: 0 }}>
                <WebView
                    key={normalizedKey || 'mv-default'}
                    ref={webRef}
                    originWhitelist={["*"]}
                    source={{ html, baseUrl }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    style={{ flex: 1, backgroundColor: 'transparent' }}
                    onMessage={onMessageHandler}
                    onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent as any;
                        console.warn('[ARPreviewViewer][WebView error] ', nativeEvent);
                    }}
                />
            </View>
        </ThemedView>
    );
}
