import {Modal} from "./Modal.tsx"

export function ConfirmDeleteModal({onClose, onConfirm, itemName, onDownloadBackup}: {
    onClose: () => void
    onConfirm: () => void
    itemName: string
    onDownloadBackup?: () => Promise<void>
}) {
    return (
        <Modal
            onClose={onClose}
            footer={
                <>
                    <button type="button" onClick={onConfirm}>Delete</button>
                    <button type="button" onClick={onClose}>Cancel</button>
                </>
            }
        >
            <p>Delete <code>{itemName}</code>?</p>
            {onDownloadBackup && (
                <p>You may want to <a href="#" onClick={async (e) => {
                    e.preventDefault()
                    await onDownloadBackup()
                }}>download</a> a copy first.</p>
            )}
        </Modal>
    )
}
