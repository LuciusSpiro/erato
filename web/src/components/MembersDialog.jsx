import { useState, useEffect, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  TextField, Select, MenuItem, IconButton, Button, CircularProgress,
  Tooltip, Alert, Divider,
} from '@mui/material'
import { Trash2, UserPlus, X } from 'lucide-react'

const ROLES = ['owner', 'editor', 'viewer']
const ROLE_LABEL = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' }

// Dialog zur Verwaltung der Mitglieder/Rollen eines Notizbuchs.
// notebook: { id, title } | null
export default function MembersDialog({ open, onClose, notebook, api }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('editor')

  const nbId = notebook?.id

  const load = useCallback(async () => {
    if (!nbId) return
    setLoading(true)
    setError(null)
    try {
      const list = await api.getMembers(nbId)
      setMembers(list ?? [])
    } catch (err) {
      if (err.status === 403) {
        setError('Keine Berechtigung, die Mitglieder dieses Notizbuchs zu verwalten.')
      } else {
        setError('Mitglieder konnten nicht geladen werden.')
      }
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [api, nbId])

  useEffect(() => {
    if (open && nbId) {
      setNewName('')
      setNewRole('editor')
      load()
    }
  }, [open, nbId, load])

  const handlePut = useCallback(async (userName, role) => {
    if (!nbId || !userName) return
    setBusy(true)
    setError(null)
    try {
      await api.putMember(nbId, { userName, role })
      await load()
    } catch (err) {
      setError(err.status === 403
        ? 'Keine Berechtigung für diese Änderung.'
        : 'Änderung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }, [api, nbId, load])

  const handleAdd = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    await handlePut(name, newRole)
    setNewName('')
    setNewRole('editor')
  }, [newName, newRole, handlePut])

  const handleDelete = useCallback(async (userSub) => {
    if (!nbId || !userSub) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteMember(nbId, userSub)
      await load()
    } catch (err) {
      setError(err.status === 403
        ? 'Keine Berechtigung zum Entfernen.'
        : 'Entfernen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }, [api, nbId, load])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <Box sx={{ flex: 1 }}>
          Mitglieder
          {notebook?.title && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              · {notebook.title}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}>
          <X size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        ) : (
          <>
            {members.length === 0 && !error && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Noch keine Mitglieder.
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {members.map((m) => (
                <Box
                  key={m.userSub}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                      {m.userName || m.userSub}
                    </Typography>
                  </Box>
                  <Select
                    size="small"
                    value={ROLES.includes(m.role) ? m.role : 'viewer'}
                    disabled={busy}
                    onChange={(e) => handlePut(m.userName || m.userSub, e.target.value)}
                    sx={{ width: 130 }}
                  >
                    {ROLES.map((r) => (
                      <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>
                    ))}
                  </Select>
                  <Tooltip title="Entfernen">
                    <span>
                      <IconButton
                        size="small"
                        disabled={busy}
                        onClick={() => handleDelete(m.userSub)}
                        sx={{ color: 'error.main' }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              Mitglied hinzufügen
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
              <TextField
                size="small"
                placeholder="Benutzername"
                value={newName}
                disabled={busy}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
                sx={{ flex: 1 }}
              />
              <Select
                size="small"
                value={newRole}
                disabled={busy}
                onChange={(e) => setNewRole(e.target.value)}
                sx={{ width: 130 }}
              >
                {ROLES.map((r) => (
                  <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>
                ))}
              </Select>
              <Button
                variant="outlined"
                size="small"
                startIcon={<UserPlus size={15} />}
                disabled={busy || !newName.trim()}
                onClick={handleAdd}
              >
                Hinzufügen
              </Button>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">Schließen</Button>
      </DialogActions>
    </Dialog>
  )
}
