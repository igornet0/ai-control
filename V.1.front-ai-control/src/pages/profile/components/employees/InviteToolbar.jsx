import React, { useState } from 'react';
import { canCreateInvites } from './employeePermissions';
import CreateInviteModal from './CreateInviteModal';

export default function InviteToolbar({ context }) {
  const [open, setOpen] = useState(false);
  if (!canCreateInvites(context)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
      >
        Создать инвайт
      </button>
      <CreateInviteModal isOpen={open} onClose={() => setOpen(false)} context={context} />
    </>
  );
}
