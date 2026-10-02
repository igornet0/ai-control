export function formatCallDiagnosticsText(diag) {
  const d = diag || {};
  const peers = Array.isArray(d.peers) ? d.peers : [];
  const peerLines = peers.length
    ? peers
        .map((p) => {
          const rtc = p.webrtc || {};
          return `- ${p.name || p.id} id=${p.id} connection=${rtc.connection || '—'} ice=${rtc.ice || '—'}`;
        })
        .join('\n')
    : '- нет пиров';
  return [
    'Видеозвонок: ошибка соединения',
    `Время: ${d.at || new Date().toISOString()}`,
    `Комната: ${d.partyRoomId || '—'}`,
    `Режим: ${d.mediaMode || '—'}`,
    `Статус: ${d.status || '—'}`,
    `Ошибка: ${d.error || '—'}`,
    `selfPeerId: ${d.selfPeerId || '—'}`,
    'Пиры:',
    peerLines,
    `User-Agent: ${d.userAgent || '—'}`,
  ].join('\n');
}
