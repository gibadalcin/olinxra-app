import React from 'react';
import { ImageSourcePropType, View, Text, Image, StyleSheet } from 'react-native';

type CustomHeaderTitleProps = {
    title: string;
    image?: ImageSourcePropType;
    headerTintColor: string;
};

const CustomHeaderTitle = React.memo(({ title, image, headerTintColor }: CustomHeaderTitleProps) => (
    <View style={styles.headerOuter}>
        <View style={styles.centerRow}>
            {image && (
                <Image
                    source={image}
                    style={styles.headerImage}
                />
            )}
            <Text style={[styles.headerTitle, { color: headerTintColor }]}>{title}</Text>
        </View>
    </View>
));

export function getHeaderOptions(
    title: string,
    image: ImageSourcePropType | undefined,
    headerTintColor: string,
    headerBackgroundColor: string,
    extraHeaderStyle?: object
) {
    return {
        title,
        headerShown: true,
        headerTitle: () => <CustomHeaderTitle title={title} image={image} headerTintColor={headerTintColor} />,
        headerStyle: {
            backgroundColor: headerBackgroundColor,
            ...(extraHeaderStyle || {}),
        },
    };
}

const styles = StyleSheet.create({
    headerOuter: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
    },
    centerRow: {
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerImage: {
        width: 32,
        height: 32,
        marginRight: 12,
        resizeMode: 'contain',
        borderColor: 'transparent',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});