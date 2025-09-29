import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

export function CameraMarkers() {
    return (
        <View
            pointerEvents="none"
            style={[
                styles.markerContainer,
                {
                    width: 250,
                    height: 200,
                    left: '50%',
                    top: '50%',
                    marginLeft: -125,
                    marginTop: -100,
                },
            ]}
        >
            <View style={styles.markerTopLeft} />
            <View style={styles.markerTopRight} />
            <View style={styles.markerBottomLeft} />
            <View style={styles.markerBottomRight} />
        </View>
    );
}

const styles = StyleSheet.create({
    markerContainer: {
        position: 'absolute',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    markerTopLeft: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 30,
        height: 30,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderColor: Colors.global.marker,
        borderRadius: 8,
    },
    markerTopRight: {
        position: 'absolute',
        right: 0,
        top: 0,
        width: 30,
        height: 30,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderColor: Colors.global.marker,
        borderRadius: 8,
    },
    markerBottomLeft: {
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: 30,
        height: 30,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderColor: Colors.global.marker,
        borderRadius: 8,
    },
    markerBottomRight: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: 30,
        height: 30,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderColor: Colors.global.marker,
        borderRadius: 8,
    },
});