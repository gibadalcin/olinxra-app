import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

const MARKER_LENGTH = 80;
const MARKER_BORDER = 1;
const MARKER_RADIUS = 2;
const MARKER_COLOR = Colors.global.marker;
const CONTAINER_WIDTH = 300;
const CONTAINER_HEIGHT = 250;

const styles = StyleSheet.create({
    markerContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
    },
    marker: {
        position: 'absolute',
        width: MARKER_LENGTH,
        height: MARKER_LENGTH,
        borderColor: MARKER_COLOR,
        borderRadius: MARKER_RADIUS,
    },
    topLeft: {
        left: 0,
        top: 0,
        borderLeftWidth: MARKER_BORDER,
        borderTopWidth: MARKER_BORDER,
    },
    topRight: {
        right: 0,
        top: 0,
        borderRightWidth: MARKER_BORDER,
        borderTopWidth: MARKER_BORDER,

    },
    bottomLeft: {
        left: 0,
        bottom: 0,
        borderLeftWidth: MARKER_BORDER,
        borderBottomWidth: MARKER_BORDER,
    },
    bottomRight: {
        right: 0,
        bottom: 0,
        borderRightWidth: MARKER_BORDER,
        borderBottomWidth: MARKER_BORDER,
    },
    zoomHintContainer: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        flexDirection: 'row',
        padding: 4,
    },
    zoomHintText: {
        fontSize: 13,
        color: MARKER_COLOR,
        fontWeight: '500',
        marginLeft: 6,
    },
});

const markerStyles = [
    styles.topLeft,
    styles.topRight,
    styles.bottomLeft,
    styles.bottomRight,
];

export function CameraMarkers() {
    return (
        <View
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
            {/* Cantos estilo Google Lens */}
            {markerStyles.map((style, idx) => (
                <View
                    key={idx}
                    style={[styles.marker, style]}
                />
            ))}
            <View style={styles.zoomHintContainer} pointerEvents="none">
                <MaterialCommunityIcons name="resize-bottom-right" size={60} color={MARKER_COLOR} style={{ marginBottom: 4, right: 4 }} />
            </View>
        </View>
    );
}