import React, { useEffect, useState } from 'react';
import { inviteService, buildInviteUrl } from '../../../../services/inviteService';
import { formatApiError } from '../../../../utils/formatApiError';

const STATUS_LABEL = {
  pending: 'Активна',
  used: 'Использована',
  expired: 'Истекла',
  revoked: 'Отозвана',
};

export default function InvitesList({ refreshKey = 0 }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setInvites(await inviteService.listInvites());
    } catch (err) {
      setError(formatApiError(err, 'Не удалось загрузить инвайты'));
      setInvites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const handleCopy = async (token) => {
    const url = buildInviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Скопируйте ссылку', url);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Отозвать эту ссылку?')) return;
    setBusyId(id);
    try {
      await inviteService.revokeInvite(id);
      await load();
    } catch (err) {
      alert(formatApiError(err, 'Не удалось отозвать ссылку'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-slate-400 text-sm">Загрузка инвайтов...</p>;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!invites.length) return <p className="text-slate-500 text-sm">Пока нет инвайт-ссылок</p>;

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border-muted)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-slate-400" style={{ borderColor: 'var(--color-border-muted)' }}>
            <th className="p-2">Имя</th>
            <th className="p-2">Email</th>
            <th className="p-2">Роль</th>
            <th className="p-2">Статус</th>
            <th className="p-2">Действия</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((invite) => (
            <tr key={invite.id} className="border-b border-slate-700/50">
              <td className="p-2 text-white">{invite.name}</td>
              <td className="p-2 text-slate-300">{invite.email}</td>
              <td className="p-2 text-slate-300">{invite.team_role}</td>
              <td className="p-2 text-slate-400">{STATUS_LABEL[invite.status] || invite.status}</td>
              <td className="p-2">
                <div className="flex flex-wrap gap-2">
                  {invite.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopy(invite.token)}
                        className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600"
                      >
                        Копировать
                      </button>
                      <button
                        type="button"
                        disabled={busyId === invite.id}
                        onClick={() => handleRevoke(invite.id)}
                        className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                      >
                        Отозвать
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
