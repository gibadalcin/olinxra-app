# 📱 Histórico do AR Nativo no Android - Explicação Técnica

## 🔍 O Problema

Quando abrimos o **Scene Viewer** (AR nativo do Google) no Android, ele **sempre cria uma Activity separada** no sistema operacional Android. Isso significa que:

1. ✅ O Scene Viewer aparece no **histórico de apps recentes** do Android (botão quadrado/multitarefa)
2. ✅ Quando o usuário pressiona o botão "Voltar" do Android, ele volta para o nosso app
3. ⚠️ **PORÉM**: O Scene Viewer fica como uma "tarefa" separada no sistema

## 🚫 Por Que Não Conseguimos Evitar Isso

### Limitações do React Native + Expo

No React Native/Expo, usamos `Linking.openURL()` para abrir o Scene Viewer:

```typescript
const url = `https://arvr.google.com/scene-viewer/1.2?file=${modelUrl}&mode=ar_preferred`;
await Linking.openURL(url);
```

**Problema**: `Linking.openURL()` usa o método nativo `startActivity()` do Android, que **sempre cria uma nova Activity** visível no histórico do sistema.

### O Que Tentamos (e Por Que Falhou)

#### ❌ Tentativa 1: Intent URI com `launchFlags`

Tentamos passar flags Android via Intent URI:

```typescript
const intentUrl = `intent://arvr.google.com/scene-viewer/1.2?file=${modelUrl}#Intent;scheme=https;package=com.google.android.googlequicksearchbox;launchFlags=0x50800000;end`;
```

**Flags usadas**:
- `0x10000000` = `FLAG_ACTIVITY_NEW_TASK`
- `0x40000000` = `FLAG_ACTIVITY_NO_HISTORY`
- `0x00800000` = `FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS`

**Resultado**: ❌ **ERRO**
```
No Activity found to handle Intent { act=android.intent.action.VIEW dat=intent://arvr.google.com/... flg=0x10000000 xflg=0x4 }
```

**Por quê falhou**: O `Linking.openURL()` do React Native **não suporta `launchFlags` no Intent URI**. Essas flags são ignoradas ou causam erro.

#### ❌ Tentativa 2: Usar `expo-intent-launcher`

O pacote `expo-intent-launcher` permitiria passar flags diretamente:

```typescript
import * as IntentLauncher from 'expo-intent-launcher';

await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
  data: sceneViewerUrl,
  flags: Intent.FLAG_ACTIVITY_NO_HISTORY
});
```

**Resultado**: ❌ **Pacote não instalado no projeto**

**Decisão**: Não adicionar dependência apenas para isso, pois:
- Adiciona complexidade
- Pode não funcionar com Scene Viewer (Google controla como a Activity é criada)
- Teria que criar módulo nativo customizado

## ✅ Solução Implementada: Navegação Limpa

### O Que Fizemos

Em vez de tentar controlar o **histórico do Android** (sistema operacional), controlamos o **histórico do React Navigation** (nosso app):

#### 1. **AppState Listener** - Detecta quando AR fecha

```typescript
useEffect(() => {
  const onAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active' && launchedForContentRef.current) {
      console.log('[ARView] 🔙 AR fechado, retornando para recognizer...');
      
      // Reset flags
      launchedForContentRef.current = false;
      launchedRef.current = false;
      
      // Navega direto para recognizer
      router.push('/(tabs)/recognizer');
    }
  };
  
  const sub = AppState.addEventListener('change', onAppStateChange);
  return () => { if (sub?.remove) sub.remove(); };
}, [router]);
```

**O que isso faz**:
- Quando o app volta ao foreground (`active`), sabemos que o AR foi fechado
- Navegamos **imediatamente** para o `recognizer` (tela de captura)
- Isso "substitui" a `ar-view` no stack de navegação do React

#### 2. **ImageDecisionModal fecha antes de navegar**

```typescript
// Em ImageDecisionModal.tsx
setLastARContent(payload);
shouldCancel = true; // Vai executar onCancel() no finally
router.push('/(tabs)/ar-view');
```

**O que isso faz**:
- Modal fecha automaticamente quando navega para AR
- Usuário não vê o modal quando volta do Scene Viewer

#### 3. **Cleanup ao desmontar componente**

```typescript
useEffect(() => {
  // ... código de inicialização
  
  return () => {
    console.log('[ARView] 🧹 Componente desmontado, limpando flags...');
    launchedRef.current = false;
    launchedForContentRef.current = false;
    actionInProgressRef.current = false;
  };
}, []);
```

**O que isso faz**:
- Garante que flags sejam resetadas quando componente é removido
- Previne comportamentos estranhos em navegações futuras

## 📊 Resultado Final

### ✅ O Que Funciona Perfeitamente

1. **Fluxo do usuário é limpo**:
   - Captura foto → Reconhece marca → Busca conteúdo → Gera GLB → Abre AR
   - Quando fecha AR: volta **direto para tela de captura**
   - Modal não fica aberto em segundo plano

2. **Stack de navegação do React é limpo**:
   - Não acumula telas `ar-view` no histórico do app
   - Navegação sempre volta para `recognizer`

3. **Auto-geração funciona**:
   - GLB é gerado automaticamente quando não há modelo
   - AR abre automaticamente quando há modelo ou após geração

### ⚠️ Limitação do Android (Inevitável)

O **Scene Viewer do Google** sempre aparecerá como uma **Activity separada** no histórico de apps recentes do Android (botão multitarefa).

**Por quê isso é aceitável**:
- É comportamento **padrão do Android** para visualizadores AR
- Apps como Google Maps, YouTube, etc. fazem o mesmo
- O usuário **não precisa gerenciar** isso manualmente
- Quando pressiona "Voltar", volta para nosso app normalmente
- Não afeta a performance ou memória

### 🎯 Como o Usuário Experimenta

1. **Abre o app** → Tira foto da marca Lenovo
2. **Clica "Buscar conteúdo"** → Sistema gera modelo 3D automaticamente
3. **Scene Viewer abre** → Usuário visualiza o objeto em AR
4. **Fecha o AR** (botão X ou Voltar) → **App volta imediatamente para a tela de captura**
5. **Pronto para nova captura** → Modal fechado, tela limpa

## 🔧 Solução Alternativa (Caso Necessário no Futuro)

Se **realmente precisarmos** evitar que o Scene Viewer apareça no histórico do Android, teríamos que:

### Opção 1: Módulo Nativo Customizado

Criar um módulo nativo Android que:
```java
// Em AndroidManifest.xml
<activity
    android:name=".ARViewerActivity"
    android:noHistory="true"
    android:excludeFromRecents="true" />

// Em código nativo
Intent intent = new Intent(Intent.ACTION_VIEW);
intent.setData(Uri.parse(sceneViewerUrl));
intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_HISTORY);
startActivity(intent);
```

**Custo**:
- Ejetar do Expo Managed Workflow → Expo Bare Workflow
- Escrever código nativo Android (Java/Kotlin)
- Manutenção complexa em futuras atualizações

### Opção 2: Usar WebXR em vez de Scene Viewer

Implementar AR dentro de um WebView usando WebXR:
- AR fica **dentro do app**
- Sem Activity externa
- **Desvantagem**: Performance inferior, menos features AR

## 📝 Conclusão

A solução implementada é a **melhor possível** dentro das limitações do React Native + Expo:

- ✅ **UX perfeita** do ponto de vista do usuário
- ✅ **Código limpo** sem hacks ou módulos nativos
- ✅ **Manutenível** e compatível com futuras versões do Expo
- ⚠️ Scene Viewer aparece no histórico do Android (limitação do sistema)

Se o requisito for **absolutamente crítico** eliminar o Scene Viewer do histórico do Android, precisaríamos migrar para **Expo Bare Workflow** e implementar módulo nativo customizado.

---

**Última atualização**: 28 de outubro de 2025
