import React from 'react';
import { ImageSourcePropType, View, Text, Image, StyleSheet } from 'react-native';

type CustomHeaderTitleProps = {
    title: string;
    image?: ImageSourcePropType;
    headerTintColor: string;
};

const CustomHeaderTitle = React.memo(({ title, image, headerTintColor }: CustomHeaderTitleProps) => (
    <View style={styles.headerContainer}>
        {image && (
            <Image
                source={image}
                style={styles.headerImage}
            />
        )}
        <Text style={[styles.headerTitle, { color: headerTintColor }]}>{title}</Text>
    </View>
));

export function getHeaderOptions(
    title: string,
    image: ImageSourcePropType | undefined,
    headerTintColor: string,
    headerBackgroundColor: string
) {
    return {
        title,
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