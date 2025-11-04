let _lastARContent: any = null;
let _lastARTimeout: any = null;
let _restartCaptureOnReturn: boolean = false;

export function setLastARContent(payload: any) {
  _lastARContent = payload;
  try { if (_lastARTimeout) clearTimeout(_lastARTimeout); } catch (e) { }
  // keep for a short grace period
  _lastARTimeout = setTimeout(() => { _lastARContent = null; _lastARTimeout = null; }, 15_000);
}

export function getLastARContent() {
  return _lastARContent;
}

// NOVO: Não consome mais, apenas limpa manualmente quando necessário
export function consumeLastARContent() {
  return _lastARContent; // NÃO apaga mais!
}

export function clearLastARContent() {
  _lastARContent = null;
  try { if (_lastARTimeout) { clearTimeout(_lastARTimeout); _lastARTimeout = null; } } catch (e) { }
}

// Controls whether the capture screen should automatically reopen the capture
// modal when the user returns from AR. This is a tiny in-memory flag intended
// to be set by the AR screen when there's no model and cleared by the capture
// screen when consumed.
export function setRestartCaptureOnReturn(v: boolean) {
  _restartCaptureOnReturn = Boolean(v);
}

export function consumeRestartCaptureOnReturn(): boolean {
  const v = _restartCaptureOnReturn;
  _restartCaptureOnReturn = false;
  return v;
}
