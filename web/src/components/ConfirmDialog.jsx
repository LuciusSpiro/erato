import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material'

// Generisches Bestätigungs-Modal (ersetzt window.confirm).
export default function ConfirmDialog({
  open, title = 'Bestätigen', message, confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen', danger = false, onConfirm, onClose,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, border: '1px solid', borderColor: 'divider' } } }}>
      <DialogTitle sx={{ fontWeight: 600 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary' }}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">{cancelLabel}</Button>
        <Button onClick={onConfirm} variant="contained" color={danger ? 'error' : 'primary'} autoFocus>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
