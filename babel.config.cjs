module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Se houver outros plugins, coloque-os aqui.
      // CRÍTICO: Este plugin DEVE ser o último na lista!
      'react-native-reanimated/plugin',
    ],
  };
};