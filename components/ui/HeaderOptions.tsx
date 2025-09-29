import React from 'react';
import { ImageSourcePropType, useColorScheme, View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

export function getHeaderOptions(
    title: string,
    image?: ImageSourcePropType // Adicione um parâmetro opcional para a imagem
) {
    const colorScheme = useColorScheme();
    const headerBackgroundColor = Colors[colorScheme ?? 'light'].headerBg;
    const headerTintColor = Colors[colorScheme ?? 'light'].headerText;

    return {
        title,
        headerShown: true,
        headerTitle: () => (
            <View style={[styles.headerContainer, { backgroundColor: headerBackgroundColor }]}>
                <View style={styles.headerContainer}>
                    {image && (
                        <Image
                            source={image}
                            style={styles.headerImage}
                        />
                    )}
                    <Text style={[styles.headerTitle, { color: headerTintColor }]}>{title}</Text>
                </View>
            </View>
        ),
    };
}

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        textAlign: 'center',
        width: '100%',
    },
    headerImage: {
        width: 32,
        height: 48,
        marginRight: 8,
        resizeMode: 'cover',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '400',
        height: 44,
        verticalAlign: 'middle',
    },
});