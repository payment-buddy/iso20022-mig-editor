import {Modal} from "./Modal"
import type {MessageImplementationGuide} from "../types/types.ts"

export function DuplicateConfirmModal({duplicates, onSkip, onOverwrite}: {
    duplicates: MessageImplementationGuide[]
    onSkip: () => void
    onOverwrite: () => void
}) {
    return (
        <Modal
            onClose={onSkip}
            title="Overwrite existing MIGs?"
            footer={
                <>
                    <button onClick={onSkip}>Skip</button>
                    <button onClick={onOverwrite}>Overwrite</button>
                </>
            }
        >
            {duplicates.length === 1 ? (
                <p>MIG "{duplicates[0].name}" already exists. Do you want to overwrite it?</p>
            ) : (
                <>
                    <p>The following MIGs already exist:</p>
                    <ul>
                        {duplicates.map(m => (
                            <li key={m.id}>"{m.name}"</li>
                        ))}
                    </ul>
                    <p>Do you want to overwrite them?</p>
                </>
            )}
        </Modal>
    )
}
