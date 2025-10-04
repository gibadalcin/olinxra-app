// Paleta centralizada para temas light, dark e global

const primaryColorLight = '#B3CDE0';
const primaryColorDark = '#012E57';
const secondaryColorLight = '#ffffff';
const secondaryColorDark = '#0047AB';
const highlightColor = '#FFD700';
const colorTextLight = '#151515ff';
const colorTextDark = '#ECEDEE';
const colorTitleLight = '#151515';
const colorTitleDark = '#B3CDE0';
const sloganColor = '#012E57';
const colorDark_01 = '#000000';
const colorDark_02 = '#687076';
const colorDark_10 = primaryColorDark;
const colorDark_20 = '#e20202ff';
const colorLight_01 = '#fcfcfc';
const colorLight_10 = '#007AFF';



export type ThemeColors = typeof Colors;

export const Colors = {
  light: {
    background: secondaryColorLight,
    text: colorTextLight,
    title: colorTitleLight,
    slogan: sloganColor,
    tint: primaryColorLight,
    icon: primaryColorDark,
    tabIconDefault: 'rgba(1, 46, 87, 0.6)',
    tabIconSelected: primaryColorDark,
    splashBackground: secondaryColorDark,
    splashProgress: colorLight_01,
    splashProgressBg: secondaryColorLight,
    textLink: colorTitleDark,
    headerText: primaryColorDark,
    headerBg: colorLight_01,
    tabBarBg: colorLight_01,
  },
  dark: {
    background: primaryColorDark,
    text: colorTextDark,
    title: colorTitleDark,
    slogan: sloganColor,
    tint: primaryColorDark,
    icon: primaryColorLight,
    tabIconDefault: 'rgba(179, 205, 224, 0.5)',
    tabIconSelected: primaryColorLight,
    splashBackground: primaryColorDark,
    splashProgress: primaryColorLight,
    splashProgressBg: colorDark_02,
    highlight: highlightColor,
    textLink: secondaryColorDark,
    headerText : primaryColorLight,
    headerBg: primaryColorDark,
  },
  global: {
    error: '#ff3b30',
    warning: '#ffcc00',
    success: '#4cd964',
    highlight: highlightColor,
    info: secondaryColorDark,
    marker: secondaryColorLight,
    dark: colorDark_01,
    grey: colorDark_02,
    blueLight: colorLight_10,
    blueDark: colorDark_10,
    blueSoft: colorTitleDark,
    light: secondaryColorLight,
    red: colorDark_20,
    soft: primaryColorLight,
    bg: secondaryColorDark
  },
};
