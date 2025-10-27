import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';

type Props = {
    title: string;
    /** quando true, deixa o header transparente (sem background) */
    transparent?: boolean;
};

export function CustomHeader({ title, transparent = false }: Props) {
    return (
        <View style={[styles.customHeader, transparent ? styles.transparent : null]}>
            <View style={styles.customHeaderContent}>
                <Image
                    source={require('@/assets/images/adaptive-icon-w.png')}
                    style={styles.headerIcon}
                />
                <View>
                    <Text style={styles.headerText}>{title}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    customHeader: {
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.global.bg + 'ee',
        paddingTop: 30,
        paddingBottom: 0,
        overflow: 'hidden',
        gap: 8,
    },
    transparent: {
        backgroundColor: 'transparent',
    },
    customHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        width: '100%',
        paddingBottom: 12,
    },
    headerIcon: {
        width: 32,
        height: 32,
        marginRight: 12,
        resizeMode: 'contain',
    },
    headerText: {
        fontSize: 20,
        height: 32,
        fontWeight: '600',
        color: Colors["global"]?.light || '#ffffff',
        textAlign: 'center',
        flex: 0,
        textShadowColor: 'rgba(0,0,0,0.12)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});

export default CustomHeader;
