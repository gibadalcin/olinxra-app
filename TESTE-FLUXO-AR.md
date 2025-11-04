# 🧪 Guia de Teste - Fluxo AR OlinxRA

## 📋 Checklist de Correções Aplicadas

✅ **Correção 1**: Removida duplicação do `LoadingCaptureModal` em `NoContentToDisplay.tsx`
✅ **Correção 2**: Adicionada validação robusta da URL do backend com fallback
✅ **Correção 3**: Melhorado tratamento de erros com logs detalhados
✅ **Correção 4**: Imports do FileSystem validados (versão 19.x OK)
✅ **Correção 5**: Logs de debug adicionados em todo o fluxo

---

## 🚀 Como Testar

### 1. Iniciar o Servidor de Desenvolvimento

```bash
cd d:\OlinxRA\olinxra-app
npm start
```

### 2. Executar no Dispositivo/Emulador

**Android:**
```bash
npm run android
```

**iOS:**
```bash
npm run ios
```

---

## 🔍 Fluxo de Teste Completo

### **Passo 1: Tela de Captura** (`recognizer/index.tsx`)

**O que testar:**
- [ ] Câmera abre corretamente
- [ ] Zoom por pinch funciona (gesto de pinça)
- [ ] Orientação opcional aparece se habilitada
- [ ] Captura de foto funciona (botão câmera)
- [ ] Seleção da galeria funciona (botão galeria)

**Logs esperados:**
```
Nenhum específico (permissões são solicitadas silenciosamente)
```

---

### **Passo 2: Modal de Decisão** (`ImageDecisionModal.tsx`)

**O que testar:**
- [ ] Imagem capturada é exibida corretamente
- [ ] Botão "Buscar conteúdo associado" está ativo
- [ ] Botão "Salvar na galeria" só está ativo se origem = câmera
- [ ] Botão "Cancelar" fecha o modal

**Ação principal: Clicar em "Buscar conteúdo associado"**

**Logs esperados:**
```
[ImageDecisionModal] 🎬 Iniciando reconhecimento de logo...
[ImageDecisionModal] 📸 URI da imagem: file://...
[compareLogo] Enviando para backend: https://olinxra-app-k828c.ondigitalocean.app
[compareLogo] Status da resposta: 200
[ImageDecisionModal] 📊 Resultado do compareLogo: recognized
[ImageDecisionModal] ✅ Logo reconhecida: <nome_da_marca>
[ImageDecisionModal] 📍 Obtendo localização atual...
[ImageDecisionModal] 📍 Localização obtida: { lat: XX.XXXX, lon: XX.XXXX }
[ImageDecisionModal] 🔍 Buscando conteúdo para marca: <nome>
[ImageDecisionModal] 📦 Resposta fetchContent: dados recebidos
[ImageDecisionModal] ✅ Conteúdo encontrado, processando blocos...
[ImageDecisionModal] 🖼️ Encontrados X blocos para processar
[ImageDecisionModal] ✅ Conversão de imagens concluída
[ImageDecisionModal] 📦 Payload montado: { marca: ..., anchorMode: ..., temBlocos: true, ... }
[ImageDecisionModal] ✅ Navegando para ar-view...
```

**Cenários de erro:**

1. **Logo não reconhecida:**
```
[ImageDecisionModal] ⚠️ Logo não encontrado no banco
```
→ Mostra modal "Ops! Não existe conteúdo..."

2. **Marca reconhecida mas sem conteúdo:**
```
[ImageDecisionModal] ⚠️ Marca reconhecida mas sem conteúdo disponível
```
→ Mostra modal com nome da marca

3. **Erro de conexão:**
```
[ImageDecisionModal] ❌ Erro na comunicação: <erro>
```
→ Alert "Falha na comunicação com o servidor"

---

### **Passo 3: Visualização AR** (`ar-view.tsx`)

**O que testar:**
- [ ] Tela AR é aberta automaticamente
- [ ] Mensagem de status aparece
- [ ] Botão "VER EM RA" está visível (se há modelo)
- [ ] AR nativo é lançado automaticamente

**Logs esperados:**
```
[ARView] finalModelUrl: https://...model.glb (ou null)
[ARView] auto-launch...
```

**Comportamentos:**

1. **Se payload tem modelo GLB:**
   - AR nativo abre automaticamente
   - Scene Viewer (Android) ou Quick Look (iOS)
   - Ao voltar do AR → retorna automaticamente para tela de captura

2. **Se payload NÃO tem modelo:**
   - Mostra: "Nenhum modelo 3D associado para RA"
   - Botão "VER EM RA" está oculto
   - Ao clicar botão manual → tenta gerar GLB da primeira imagem

**Logs ao gerar GLB:**
```
[AR] Gerar GLB para image_url: https://...
[AR] resposta generate-glb-from-image status: 200
[AR] GLB gerado: https://...signed_url.glb
```

---

## 🐛 Solução de Problemas Comuns

### ❌ Erro: "Backend URL não configurada"

**Causa:** Variável de ambiente não carregada

**Solução:**
1. Verificar arquivo `.env` existe na raiz do projeto
2. Reiniciar o Metro bundler (`npm start` novamente)
3. Limpar cache: `npm start -- --clear`

---

### ❌ Erro: "Permissão necessária"

**Causa:** Permissões de câmera/localização/galeria não concedidas

**Solução:**
1. Android: Ir em Configurações > Apps > OlinxRA > Permissões
2. iOS: Configurações > Privacidade > Câmera/Localização/Fotos
3. Conceder todas as permissões
4. Reiniciar o app

---

### ❌ AR não abre automaticamente

**Causa 1:** Dispositivo não suporta AR
**Solução:** Verificar logs para `supportsAR = false`

**Causa 2:** Google Play Services for AR não instalado (Android)
**Solução:** Instalar da Play Store: https://play.google.com/store/apps/details?id=com.google.ar.core

**Causa 3:** iOS < 11.0
**Solução:** Atualizar iOS para versão 11 ou superior

---

### ❌ "Nenhum logo reconhecido com confiança suficiente"

**Causa:** Imagem com baixa similaridade (< 70%)

**Solução:**
1. Tirar foto mais clara e centralizada
2. Melhorar iluminação
3. Aproximar da logomarca
4. Verificar se logo está cadastrado no backend

---

### ❌ "Ops! Não existe conteúdo associado..."

**Causa:** Marca reconhecida mas sem conteúdo cadastrado para aquela localização

**Solução:**
1. Verificar no admin se há conteúdo cadastrado
2. Verificar se o raio de busca está configurado corretamente
3. Tentar em outra localização ou adicionar conteúdo regional

---

## 📊 Endpoints Configurados

Verificar em `config/api.ts`:

```typescript
BASE_URL: https://olinxra-app-k828c.ondigitalocean.app
ENDPOINTS:
  - COMPARE_LOGO: /search-logo/
  - CONSULTA_CONTEUDO: /consulta-conteudo/
  - CONTEUDO_POR_REGIAO: /api/conteudo-por-regiao
  - CONTEUDO_POR_RADIUS: /api/conteudo
  - GENERATE_GLB: /api/generate-glb-from-image
  - REVERSE_GEOCODE: /api/reverse-geocode
```

---

## 🔧 Comandos Úteis

```bash
# Limpar cache e reinstalar
npm start -- --clear
rm -rf node_modules && npm install

# Ver logs em tempo real (Android)
npx react-native log-android

# Ver logs em tempo real (iOS)
npx react-native log-ios

# Build de produção Android
npm run android -- --variant=release

# Build de produção iOS
npm run ios -- --configuration Release
```

---

## ✅ Checklist Final de Validação

- [ ] **Captura de imagem** funciona (câmera e galeria)
- [ ] **Reconhecimento de logo** retorna marca correta
- [ ] **Busca de conteúdo** retorna blocos válidos
- [ ] **Conversão de imagens** para base64 funciona
- [ ] **Payload completo** é montado com todas as propriedades
- [ ] **Navegação para AR** acontece automaticamente
- [ ] **AR nativo** abre (Scene Viewer ou Quick Look)
- [ ] **Retorno do AR** volta para tela de captura
- [ ] **Logs detalhados** aparecem no console
- [ ] **Tratamento de erros** funciona para todos os cenários

---

## 📝 Notas Adicionais

### Anchor Modes

- **`totem`**: Usado para imagens da galeria → cria totem na localização GPS do usuário
- **`bbox`**: Usado quando detecção retorna bounding box → ancora na posição da logo
- **`tap`**: Fallback para câmera sem bbox → usuário toca para posicionar

### Conversão de Imagens

- Até **3 imagens** são convertidas para base64
- Limite de **2.5 MB** por imagem
- Prioriza imagens dos blocos principais
- Garante disponibilidade offline no WebView

---

**Última atualização:** 28 de outubro de 2025
**Versão do app:** 1.0.0
**Expo SDK:** 54.0.21
