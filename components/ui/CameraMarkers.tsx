import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

const MARKER_SIZE = 30;
const MARKER_BORDER = 4;
const MARKER_RADIUS = MARKER_BORDER;
const MARKER_COLOR = Colors.global.marker;
const CONTAINER_WIDTH = 250;
const CONTAINER_HEIGHT = 200;

const styles = StyleSheet.create({
    markerContainer: {
        position: 'absolute',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    marker: {
        position: 'absolute',
        width: MARKER_SIZE,
        height: MARKER_SIZE,
        borderRadius: MARKER_RADIUS,
    },
    zoomHintContainer: {
        position: 'absolute',
        bottom: 2,
        left: 6,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        flexDirection: 'row',
    },
    zoomHintText: {
        fontSize: 13,
        color: MARKER_COLOR,
        fontWeight: '500',
        marginLeft: 6,
    },
});

const markerStyles = [
    // Top Left
    {
        left: 0,
        top: 0,
        borderTopWidth: MARKER_BORDER,
        borderLeftWidth: MARKER_BORDER,
    },
    // Top Right
    {
        right: 0,
        top: 0,
        borderTopWidth: MARKER_BORDER,
        borderRightWidth: MARKER_BORDER,
    },
    // Bottom Left
    {
        left: 0,
        bottom: 0,
        borderBottomWidth: MARKER_BORDER,
        borderLeftWidth: MARKER_BORDER,
    },
    // Bottom Right
    {
        right: 0,
        bottom: 0,
        borderBottomWidth: MARKER_BORDER,
        borderRightWidth: MARKER_BORDER,
    },
];

export function CameraMarkers() {
    return (
        <View
            pointerEvents="none"
            style={[
                styles.markerContainer,
                {
                    width: CONTAINER_WIDTH,
                    height: CONTAINER_HEIGHT,
                    left: '50%',
                    top: '50%',
                    marginLeft: -CONTAINER_WIDTH / 2,
                    marginTop: -CONTAINER_HEIGHT / 2,
                },
            ]}
        >
            {markerStyles.map((style, idx) => (
                <View
                    key={idx}
                    style={[
                        styles.marker,
                        style,
                        {
                            borderColor: MARKER_COLOR,
                        },
                    ]}
                />
            ))}
            <View style={styles.zoomHintContainer} pointerEvents="none">
                <Ionicons name="resize" size={28} color={MARKER_COLOR} style={{ marginBottom: 4 }} />
            </View>
        </View>
    );
}