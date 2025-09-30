import React from 'react';
import { ImageSourcePropType, View, Text, Image, StyleSheet } from 'react-native';
// Colors será passado como parâmetro

// Novo componente que lida com o hook
function CustomHeaderTitle({ title, image, headerTintColor }: { title: string, image?: ImageSourcePropType, headerTintColor: string }) {
    return (
        <View style={styles.headerContainer}>
            {image && (
                <Image
                    source={image}
                    style={styles.headerImage}
                />
            )}
            <Text style={[styles.headerTitle, { color: headerTintColor }]}>{title}</Text>
        </View>
    );
}

export function getHeaderOptions(
    title: string,
    image: ImageSourcePropType | undefined,
    headerTintColor: string,
    headerBackgroundColor: string
) {
    return {
        title: title,
        headerShown: true,
        headerTitle: () => <CustomHeaderTitle title={title} image={image} headerTintColor={headerTintColor} />,
        headerStyle: {
            backgroundColor: headerBackgroundColor,
        },
    };
}

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'black',
    },
    headerImage: {
        width: 32,
        height: 32,
        marginRight: 8,
        resizeMode: 'contain',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
});