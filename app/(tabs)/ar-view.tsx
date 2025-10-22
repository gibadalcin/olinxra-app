import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { consumeLastARContent } from '@/utils/lastARContent';

export default function ARViewScreen() {
    const [payload, setPayload] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    // RN fallback renderer toggle removed for cleaner AR view UI

    useEffect(() => {
        const p = consumeLastARContent();
        setPayload(p);
        setLoading(false);
    }, []);

    const webRef = useRef<any>(null);

    // Safe URL opener - avoid throwing on invalid links
    async function safeOpenUrl(url?: string | null) {
        try {
            if (!url || typeof url !== 'string') {
                console.warn('[ARView] safeOpenUrl: invalid url', url);
                return;
            }
            const supported = await Linking.canOpenURL(url);
            if (!supported) {
                console.warn('[ARView] safeOpenUrl: cannot open url', url);
                // show a non-blocking alert so user knows
                try { Alert.alert('Link indisponível', 'Não foi possível abrir o link.'); } catch (e) { }
                return;
            }
            await Linking.openURL(url);
        } catch (e) {
            console.warn('[ARView] safeOpenUrl failed', e, url);
        }
    }

    // WebView is the primary renderer for AR content in this POC; RN fallback removed to simplify UI

    // prepare an embedded, JSON-escaped payload to inject into the HTML as a fallback
    const embeddedPayloadForHtml = React.useMemo(() => {
        try {
            if (!payload) return 'null';
            // escape '<' to avoid closing script tags when embedded
            return JSON.stringify({ type: 'payload', payload }).replace(/</g, '\\u003c');
        } catch (e) { return 'null'; }
    }, [payload]);

    const html = useMemo(() => {

        // Define a URL do modelo, usando o padrão do payload se disponível
        const modelUrl = (payload && payload.anchorData && payload.anchorData.totem && payload.anchorData.totem.modelUrl) || 'https://modelviewer.dev/shared-assets/models/Astronaut.glb';

        // Constrói dinamicamente os hotspots a partir do payload
        let hotspotsHtml = '';
        if (payload && payload.anchorData && payload.anchorData.totem && payload.anchorData.totem.brands) {
            Object.entries(payload.anchorData.totem.brands).forEach(([key, brandData]: [string, any], index) => {
                const brandKey = key.replace(/\W+/g, '_');
                const posArr = (brandData.hotspotPosition && Array.isArray(brandData.hotspotPosition)) ? brandData.hotspotPosition : brandData.position || [0.25, 0.35 - (index * 0.1), 0.1];
                const url = brandData.url || brandData.contentUrl || '#';

                hotspotsHtml += `
                    <button 
                        slot="hotspot-${brandKey}" 
                        data-position="${posArr.join(' ')}" 
                        data-brand="${key}" 
                        data-url="${url}"
                        onclick="handleHotspotClick(this)"
                        style="background: #e74c3c; border-radius: 50%; width: 20px; height: 20px; border: 3px solid #fff; cursor: pointer;"
                        title="Clique para o Conteúdo ${key}"
                    >
                    </button>
                `;
            });
        }

        return `
            <!doctype html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                <script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>
                <style>
                    body{font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial; padding:0; margin:0; color:#111}
                    img{max-width:100%; height:auto; border-radius:8px}
                    .block{margin-bottom:12px}
                    .carousel{display:flex; gap:8px; overflow-x:auto; padding:8px 0}
                    .carousel img{flex:0 0 auto; width:140px; height:100px; object-fit:cover; border-radius:6px}
                    /* ... (restante dos estilos CSS de botão e layout) ... */
                </style>
            </head>
            <body>
                <model-viewer
                    id="totem-mv"
                    src="${modelUrl}"
                    alt="Totem Âncora AR"
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    camera-controls
                    shadow-intensity="1"
                    style="width: 100%; height: 100vh; position: fixed; top: 0; left: 0; z-index: 1000;"
                    ar-button 
                >
                    ${hotspotsHtml}
                    <button slot="ar-button" style="background:#fff; color:#111; padding: 10px 20px; border-radius: 4px; border: none; position: fixed; bottom: 20px; right: 20px; z-index: 1001;">
                        Ver em AR
                    </button>
                </model-viewer>

                <div id="root" style="position:fixed; left:0; top:0; width:100%; height:100vh; z-index:1001; overflow:hidden; background:transparent; pointer-events: none;">
                    
                    <div id="contentWrapper" style="padding: 12px; pointer-events: auto; background: rgba(255,255,255,0.95); border-radius: 8px; margin: 12px; display: none;">
                        Conteúdo será injetado aqui...
                    </div>
                </div>
                
                <script>
                    function post(type, data){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type:type}, data||{}))); }catch(e){} }
                    
                    // Ajuste a função handleHotspotClick para mostrar o overlay de conteúdo
                    function handleHotspotClick(element){
                        try{
                            var url = element.getAttribute('data-url');
                            var brand = element.getAttribute('data-brand');
                            var root = document.getElementById('root');
                            var wrapper = document.getElementById('contentWrapper');

                            if (root && wrapper) {
                                // 1. Torna o wrapper de conteúdo visível e o root clicável
                                wrapper.style.display = 'block';
                                // Injetar aqui o conteúdo dinâmico (não apenas o título como no exemplo anterior)
                                wrapper.innerHTML = '<h2>Conteúdo de ' + (brand || 'Marca') + '</h2><p>Clique no botão abaixo para abrir o link.</p>'
                                    + '<a href="#" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({ type: \'hotspot_click\', href: \'' + url + '\', brand: \'' + brand + '\' })); return false;" class="btn primary">Abrir Conteúdo Externo</a>'
                                    + '<button onclick="document.getElementById(\'contentWrapper\').style.display = \'none\'; document.getElementById(\'root\').style.pointerEvents = \'none\';" style="margin-left: 10px;">Fechar</button>';
                                
                                root.style.pointerEvents = 'auto';
                            }
                            
                            // 2. Notifique o RN (apenas para logs e navegação se for o caso)
                            post('hotspot_click', { href: url, brand: brand });
                        }catch(e){ post('web_error', { message: 'handleHotspotClick failed: ' + (e && e.message) }); }
                    }

                    // ... (O restante das funções JS onMessage e renderPayload) ...
                    
                    function requestPayload(){
                        try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'request_payload' })); }catch(e){}
                    }
                    setTimeout(requestPayload, 120);
                    setTimeout(requestPayload, 600);
                    
                    // Funções setupTotem e renderPayload foram simplificadas:
                    
                    function setupTotem(payload){
                        try{
                            var mv = document.getElementById('totem-mv');
                            if(!mv){ post('totem_event', { event: 'modelviewer_not_found' }); return; }
                            post('totem_event', { event: 'hotspots_injected', brandCount: Object.keys((payload.anchorData && payload.anchorData.totem && payload.anchorData.totem.brands) || {}).length });
                        }catch(e){ post('web_error', { message: 'setupTotem failed: ' + (e && e.message) }); }
                    }
                    
                    function renderPayload(payload){
                        try{
                            var root = document.getElementById('root');
                            var wrapper = document.getElementById('contentWrapper');
                            // ... (toda a lógica de normalização de blocos do seu código) ...
                            var blocos = null;
                            try{
                                if(payload){
                                    blocos = payload.blocos || payload.conteudo || null;
                                    if(blocos && typeof blocos === 'object' && !Array.isArray(blocos)){
                                        if(Array.isArray(blocos.blocos)) blocos = blocos.blocos;
                                        else if(Array.isArray(blocos.conteudo)) blocos = blocos.conteudo;
                                    }
                                    if(Array.isArray(blocos) && blocos.length === 1 && Array.isArray(blocos[0])) blocos = blocos[0];
                                }
                            }catch(e){ blocos = null; }
                            
                            if(!payload || !blocos){ wrapper.innerHTML = 'Nenhum conteúdo disponível para exibir.'; wrapper.style.display = 'block'; return; }

                            var html = '<h2>' + (payload.nome_marca || 'Conteúdo AR') + '</h2>';
                            if(Array.isArray(blocos)){
                                blocos.forEach(function(b){
                                    html += '<div class="block">';
                                    try{
                                        var text = b.texto || b.conteudo || b.descricao || null;
                                        if(text){ try{ if(typeof text === 'string'){ if(text.match(/(^|\s)(gs:\/\/|https?:\/\/)/i)) text = ''; } }catch(e){} if(text) html += '<p>' + (text || '') + '</p>'; }
                                        function pickImage(o){ if(!o) return null; if(o.signed_url) return o.signed_url; if(o.url) return o.url; if(o.conteudo && typeof o.conteudo === 'string') return o.conteudo; if(o.imagem) return o.imagem; return null; }
                                        var img = pickImage(b);
                                        if(img) html += '<img src="' + img + '" />';
                                        var carousel = b.items || b.itens || null;
                                        if(Array.isArray(carousel) && carousel.length){ html += '<div class="carousel">'; carousel.forEach(function(it){ try{ var itimg = pickImage(it); if(itimg) html += '<img src="' + itimg + '" style="margin-right:8px; width:120px; height:auto;"/>'; }catch(e){} }); html += '</div>'; }
                                        if((b.tipo && b.tipo.toString().toLowerCase().includes('botao')) || b.tipo === 'botao_destaque' || b.label){ try{ var label = b.label || (b.texto || 'Abrir'); var href = (b.action && b.action.href) ? b.action.href : (b.href || '#'); var variant = (b.variant || 'primary'); var color = b.color || null; var styleAttr = ''; if(color){ styleAttr = 'style="background:' + color + ';"'; } html += '<div style="margin-top:8px; text-align:' + (b.position || 'left') + '">'; var iconSide = (b.iconSide || b.iconPosition || 'left'); var iconHtml = '<span class="btn-icon ' + (iconSide === 'right' ? 'right' : 'left') + '">🔗</span>'; if(iconSide === 'right'){ var btnId = 'btn_' + Math.random().toString(36).slice(2); html += '<a class="btn ' + variant + '" data-id="' + btnId + '" data-href="' + href + '" href="#" ' + styleAttr + '>' + '<span class="btn-inner"><span class="btn-label">' + label + '</span>' + iconHtml + '</span>' + '</a>'; } else { var btnId = 'btn_' + Math.random().toString(36).slice(2); html += '<a class="btn ' + variant + '" data-id="' + btnId + '" data-href="' + href + '" href="#" ' + styleAttr + '>' + '<span class="btn-inner">' + iconHtml + '<span class="btn-label">' + label + '</span></span>' + '</a>'; } html += '</div>'; }catch(e){} }
                                    }catch(e){}
                                    html += '</div>';
                                });
                            }

                            // INJETAR CONTEÚDO NO WRAPPER 2D
                            try{ wrapper.innerHTML = html; wrapper.style.display = 'block'; }catch(e){ post('web_error', { message: 'failed to inject content: ' + (e && e.message) }); }
                            
                            // CHAMA O SETUP DO TOTEM
                            try{ if(payload && payload.anchorMode === 'totem'){ setupTotem(payload); } }catch(e){}
                            
                            // ANEXAR CLICKS AO CONTEÚDO 2D (A[data-href])
                            try{ var anchors = wrapper.querySelectorAll('a[data-href]'); anchors.forEach(function(a){ a.addEventListener('click', function(ev){ try{ ev.preventDefault(); var href = a.getAttribute('data-href'); var id = a.getAttribute('data-id'); window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tag_click', href: href, id: id })); }catch(e){} }); }); }catch(e){}

                        }catch(e){ document.getElementById('root').innerText = 'Erro ao renderizar conteúdo.'; }
                    }

                    function onMessage(e){
                        try{
                            var data = e && e.data ? e.data : (window && window.__RN_MESSAGE__ ? window.__RN_MESSAGE__ : null);
                            if(!data) return;
                            var msg = typeof data === 'string' ? JSON.parse(data) : data;
                            try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'received_raw', summary: (typeof msg === 'string' ? msg.slice(0,200) : (msg && msg.type ? msg.type : 'object')) })); }catch(e){}
                            if(msg && msg.type === 'payload' && msg.payload){
                                renderPayload(msg.payload);
                                try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'rendered', ok: true })); }catch(e){}
                                return;
                            }
                            if(msg && msg.type === 'request_payload') return;
                            renderPayload(msg);
                            try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'rendered', ok: true })); }catch(e){}
                        }catch(err){
                            document.getElementById('root').innerText = 'Erro ao renderizar conteúdo.';
                            try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'rendered', ok: false, error: String(err) })); }catch(e){}
                        }
                    }

                    document.addEventListener('message', onMessage);
                    window.addEventListener('message', onMessage);
                    try{ if(window.__RN_MESSAGE__) onMessage({ data: window.__RN_MESSAGE__ }); } catch(e){}
                    try{ if(${embeddedPayloadForHtml} && ${embeddedPayloadForHtml} !== 'null') onMessage({ data: ${embeddedPayloadForHtml} }); } catch(e){}
                </script>
            </body>
            </html>
        `;
    }, [embeddedPayloadForHtml, payload]); // Adicionei 'payload' aqui para reconstruir a HTML no caso de mudança de dados.

    // send payload via postMessage after a tick, with a couple retries
    useEffect(() => {
        const send = () => {
            try {
                if (webRef.current && payload) {
                    console.debug('[ARView] posting payload to WebView', payload && (payload.nome_marca || 'payload'));
                    webRef.current.postMessage(JSON.stringify({ type: 'payload', payload }));
                    // also set a window var as fallback for some platforms
                    const setFallback = `(function(){try{window.__RN_MESSAGE__ = ${JSON.stringify({ type: 'payload', payload })};}catch(e){}})();true;`;
                    webRef.current.injectJavaScript && webRef.current.injectJavaScript(setFallback);
                    // dynamic totem injection removed - <model-viewer> is static in the HTML and hotspots are handled via setupTotem
                    console.debug('[ARView] postMessage + injectJavaScript attempted');
                }
            } catch (e) { }
        };
        send();
        const t1 = setTimeout(send, 300);
        const t2 = setTimeout(send, 900);
        return () => { try { clearTimeout(t1); clearTimeout(t2); } catch (e) { } };
    }, [payload]);
    // handle messages coming FROM the WebView (including request_payload)
    const handleWebViewMessage = React.useCallback((event: any) => {
        try {
            const d = JSON.parse(event.nativeEvent.data);
            if (d && d.type === 'request_payload') {
                console.debug('[ARView] WebView requested payload');
                if (webRef.current && payload) {
                    webRef.current.postMessage(JSON.stringify({ type: 'payload', payload }));
                    console.debug('[ARView] responded to request_payload');
                }
                return;
            }
            // tag click from WebView (button/tag inside HTML)
            if (d && d.type === 'tag_click') {
                try {
                    console.debug('[ARView] tag clicked in WebView', d);
                    if (d.href) safeOpenUrl(d.href);
                } catch (e) { console.debug('[ARView] failed to open tag href', e); }
                return;
            }
            // hotspot click from model-viewer
            if (d && d.type === 'hotspot_click') {
                try {
                    console.debug('[ARView] hotspot clicked in WebView', d);
                    if (d.href) safeOpenUrl(d.href);
                } catch (e) { console.debug('[ARView] failed to handle hotspot_click', e); }
                return;
            }
            // debug notifications coming from WebView (received_raw, rendered, etc.)
            if (d && d.type) {
                console.debug('[ARView] message from WebView type=' + d.type, d);
            } else {
                console.debug('[ARView] got message from WebView', d);
            }
        } catch (e) { console.debug('[ARView] got message (non-json)'); }
    }, [payload]);

    if (loading) return <View style={styles.center}><ActivityIndicator /></View>;
    if (!payload) return <View style={styles.center}><Text>Nenhum conteúdo disponível para exibir.</Text></View>;

    return (
        <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <View style={{ flex: 1, height: 600 }}>
                    <WebView
                        ref={webRef}
                        originWhitelist={["*"]}
                        source={{ html }}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        style={{ flex: 1 }}
                        onMessage={handleWebViewMessage}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});