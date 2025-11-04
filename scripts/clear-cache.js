#!/usr/bin/env node

/**
 * Script para limpar cache AsyncStorage do app
 * 
 * USO:
 * 1. Conectar dispositivo/emulador Android
 * 2. Executar: node scripts/clear-cache.js
 * 
 * OU adicionar no package.json:
 * "scripts": { "clear-cache": "node scripts/clear-cache.js" }
 * Depois executar: npm run clear-cache
 * 
 * IMPORTANTE: Após rodar o script, abra o app e teste novamente!
 */

const { execSync } = require('child_process');

console.log('🧹 Limpando cache AsyncStorage do OlinxRA...\n');

try {
  // Verificar se dispositivo está conectado
  console.log('📱 Verificando dispositivos conectados...');
  const devices = execSync('adb devices', { encoding: 'utf-8' });
  console.log(devices);
  
  if (!devices.includes('device')) {
    console.error('\n❌ Nenhum dispositivo conectado!');
    console.error('   - Conecte o dispositivo via USB');
    console.error('   - Ou inicie o emulador Android');
    console.error('   - Execute "adb devices" para verificar\n');
    process.exit(1);
  }
  
  // Limpar dados do app (mantém instalação)
  console.log('\n📱 Limpando dados do app...');
  execSync('adb shell pm clear host.exp.exponent', { stdio: 'inherit' });
  
  console.log('\n✅ Cache limpo com sucesso!');
  console.log('\n📝 Próximos passos:');
  console.log('   1. Reabrir app no dispositivo');
  console.log('   2. Fazer nova captura da logo g3');
  console.log('   3. Clicar em "Buscar conteúdo associado"');
  console.log('   4. Verificar se o loader aparece com dicas');
  console.log('   5. Após carregar, verificar se aparecem 5 GLBs (4 carousel + 1 imagem topo)');
  console.log('   6. Navegar entre os modelos com ◀ ▶');
  console.log('   7. Clicar "Ver em RA" e verificar se abre corretamente\n');
} catch (error) {
  console.error('\n❌ Erro ao limpar cache:');
  console.error('   - Verifique se dispositivo está conectado (adb devices)');
  console.error('   - Verifique se app está instalado (Expo Go)\n');
  console.error(error.message);
  process.exit(1);
}
