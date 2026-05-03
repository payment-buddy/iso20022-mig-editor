import {useEffect, useRef} from "react"

export function Modal({onClose, title, children, footer}: {
    onClose: () => void
    title?: string
    children: React.ReactNode
    footer?: React.ReactNode
}) {
    const contentRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    function handleBackdropClick(e: React.MouseEvent) {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={handleBackdropClick}
        >
            <div
                ref={contentRef}
                style={{
                    backgroundColor: 'Canvas',
                    border: '1px solid #ccc',
                    borderRadius: 8,
                    padding: '1.5rem',
                    maxWidth: 480,
                    width: '90%',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                }}
                onClick={e => e.stopPropagation()}
            >
                {title && <strong style={{fontSize: '1.1em'}}>{title}</strong>}
                {children}
                {footer && <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>{footer}</div>}
            </div>
        </div>
    )
}
