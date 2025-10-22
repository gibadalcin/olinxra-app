let _lastARContent: any = null;
let _lastARTimeout: any = null;

export function setLastARContent(payload: any) {
  _lastARContent = payload;
  try { if (_lastARTimeout) clearTimeout(_lastARTimeout); } catch (e) {}
  // keep for a short grace period
  _lastARTimeout = setTimeout(() => { _lastARContent = null; _lastARTimeout = null; }, 15_000);
}

export function getLastARContent() {
  return _lastARContent;
}

export function consumeLastARContent() {
  const v = _lastARContent;
  _lastARContent = null;
  try { if (_lastARTimeout) { clearTimeout(_lastARTimeout); _lastARTimeout = null; } } catch (e) {}
  return v;
}

export function clearLastARContent() {
  _lastARContent = null;
  try { if (_lastARTimeout) { clearTimeout(_lastARTimeout); _lastARTimeout = null; } } catch (e) {}
}
